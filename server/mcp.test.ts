import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Client } from "../seed/clients";
import type { Post } from "../seed/posts";
import { ACTIVE } from "../templates/index";
import { ACTIVE_TEMPLATE } from "../templates/active";
import { authorized, handleMcp, mintToken, TOOLS } from "./mcp";
import { openStore, referralRefusal, type Store } from "./store";

/** The seeded rows are the active template's, so they are named by what they are, never by id. */
const seedPosts = ACTIVE_TEMPLATE.seed.posts as Post[];
const anyClient = (ACTIVE_TEMPLATE.seed.clients as Client[])[0]!.id;
const readyPost = seedPosts.find((p) => p.status === "ready")!;

const dirs: string[] = [];
const freshStore = (): Store => {
  const dir = mkdtempSync(join(tmpdir(), "sga-mcp-"));
  dirs.push(dir);
  return openStore(join(dir, "store.json"));
};
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const rpc = (method: string, params?: unknown, id = 1) => JSON.stringify({ jsonrpc: "2.0", id, method, params });
const call = (name: string, args: Record<string, unknown>) => rpc("tools/call", { name, arguments: args });
type CallResult = { result: { content: { text: string }[]; isError?: boolean } };

describe("mcp auth", () => {
  it("refuses missing, malformed and unknown bearer tokens", () => {
    const store = freshStore();
    expect(authorized(store, undefined)).toBe(false);
    expect(authorized(store, "Basic abc")).toBe(false);
    expect(authorized(store, "Bearer mcp_notminted")).toBe(false);
  });

  it("accepts a minted token and refuses it after revocation", () => {
    const store = freshStore();
    const minted = mintToken(store, "claude");
    expect(minted.token.startsWith("mcp_")).toBe(true);
    // Only the hash is persisted — the plaintext never touches the store file.
    expect(JSON.stringify(store.read())).not.toContain(minted.token);
    expect(authorized(store, `Bearer ${minted.token}`)).toBe(true);
    store.removeMcpToken(minted.id);
    expect(authorized(store, `Bearer ${minted.token}`)).toBe(false);
  });

  it("accepts the platform-injected token alongside minted ones", () => {
    const store = freshStore();
    const platform = "vmt_platform_minted_secret";
    expect(authorized(store, `Bearer ${platform}`, platform)).toBe(true);
    expect(authorized(store, "Bearer vmt_platform_minted_secreT", platform)).toBe(false);
    expect(authorized(store, "Bearer vmt_", platform)).toBe(false);
    // Nothing about the platform token lands in the store.
    expect(JSON.stringify(store.read())).not.toContain(platform);
    const minted = mintToken(store, "claude");
    expect(authorized(store, `Bearer ${minted.token}`, platform)).toBe(true);
  });

  it("disables the platform path when the token is unset or empty", () => {
    const store = freshStore();
    expect(authorized(store, "Bearer anything", undefined)).toBe(false);
    expect(authorized(store, "Bearer ", "")).toBe(false);
    expect(authorized(store, "Bearer anything", "")).toBe(false);
  });
});

describe("mcp protocol", () => {
  it("answers initialize with the tools capability", async () => {
    const answer = (await handleMcp(rpc("initialize"), freshStore(), null)) as {
      result: { capabilities: { tools: object }; serverInfo: { name: string } };
    };
    expect(answer.result.serverInfo.name).toBe("agency");
    expect(answer.result.capabilities.tools).toEqual({});
  });

  it("lists every workstream tool", async () => {
    const answer = (await handleMcp(rpc("tools/list"), freshStore(), null)) as { result: { tools: { name: string }[] } };
    expect(answer.result.tools.map((t) => t.name)).toEqual(TOOLS.map((t) => t.name));
    expect(answer.result.tools.map((t) => t.name)).toContain("start_agent_session");
  });

  it("swallows notifications and rejects unknown methods", async () => {
    const store = freshStore();
    expect(await handleMcp(rpc("notifications/initialized"), store, null)).toBeNull();
    const bad = (await handleMcp(rpc("resources/list"), store, null)) as { error: { code: number } };
    expect(bad.error.code).toBe(-32601);
    const parse = (await handleMcp("not json", store, null)) as { error: { code: number } };
    expect(parse.error.code).toBe(-32700);
  });
});

describe("mcp tools", () => {
  it("create_client makes a signed client in the same store the dashboard reads", async () => {
    const store = freshStore();
    const before = store.read().clients.length;
    const answer = (await handleMcp(call("create_client", {
      name: "Pine & Post", domain: "pineandpost.example",
      contact_name: "Ada", contact_email: "ada@pineandpost.example", contact_role: "CEO",
      crm_contact: "ctc_pine", note: "Won over MCP.",
    }), store, null)) as CallResult;
    const client = JSON.parse(answer.result.content[0]!.text) as Client & { agents: unknown };
    expect(client).toMatchObject({ stage: "active", slug: "pine-post", crmContact: "ctc_pine", agents: null });
    expect(client.onboardedAt).toBeDefined();
    expect(store.read().clients).toHaveLength(before + 1);
    expect(store.read().clients.at(-1)?.id).toBe(client.id);
    expect(store.read().clients.at(-1)).not.toHaveProperty("agents");
    // The same won deal again is the same client, and a crm_contact must be a CRM contact id.
    const again = JSON.parse(((await handleMcp(call("create_client", { name: "Pine and Post", crm_contact: "ctc_pine" }), store, null)) as CallResult).result.content[0]!.text) as Client;
    expect(again.id).toBe(client.id);
    expect(((await handleMcp(call("create_client", { name: "X", crm_contact: "cli_1" }), store, null)) as CallResult).result.isError).toBe(true);
  });

  it("create_client onboards the won client's crew on the platform in the same call", async () => {
    const upstream = vi.fn().mockImplementation(async (url: string, init?: RequestInit) =>
      url.includes("/v1/agents?") ? new Response(JSON.stringify({ data: [], has_more: false }), { status: 200 })
        : new Response(JSON.stringify({ id: `agt_${Math.random().toString(16).slice(2)}`, current_version: 1, method: init?.method }), { status: 200 }));
    vi.stubGlobal("fetch", upstream);
    try {
      const config = { baseUrl: "https://api.example", apiKey: "secret", identityId: null, project: "agency" };
      const answer = (await handleMcp(call("create_client", { name: "Won Co", domain: "won.example", crm_contact: "ctc_won" }), freshStore(), config)) as CallResult;
      const { agents } = JSON.parse(answer.result.content[0]!.text) as { agents: { name: string; action: string }[] };
      expect(agents.map((a) => a.name)).toEqual(ACTIVE_TEMPLATE.crew.map((m) => `${m.name}--won-co`));
      // The agency's own record is not a client: no crew, no platform call.
      upstream.mockClear();
      await handleMcp(call("create_client", { name: "Our Agency" }), freshStore(), config);
      expect(upstream).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("create_client needs only a name: the agency's own record is filed without a contact to ask for", async () => {
    const store = freshStore();
    const answer = (await handleMcp(call("create_client", { name: "Northwind Studio" }), store, null)) as CallResult;
    const own = JSON.parse(answer.result.content[0]!.text) as Client;
    expect([own.domain, own.contact.email, own.onboardedAt]).toEqual(["", "", undefined]);
    expect(store.read().clients.at(-1)?.id).toBe(own.id);
  });

  it("create_client says when a name alone landed on the agency's own record under another name", async () => {
    const store = freshStore();
    const file = async (args: Record<string, unknown>) =>
      JSON.parse(((await handleMcp(call("create_client", args), store, null)) as CallResult).result.content[0]!.text) as Client & { notice?: string };
    const own = await file({ name: "Sandline Studio" });
    expect(own.notice).toBeUndefined();
    const client = await file({ name: "Brightfold Home" });
    expect(client.id).toBe(own.id);
    expect(client.notice).toMatch(/agency's own record, so this is Sandline Studio \(cli_[0-9a-f]+\), not a new "Brightfold Home"/);
    expect(store.read().clients.find((c) => c.id === own.id)).not.toHaveProperty("notice");
    const real = await file({ name: "Brightfold Home", domain: "brightfold.example" });
    expect([real.id === own.id, real.notice]).toEqual([false, undefined]);
  });

  it("offers no pipeline tool: leads, stages and their notes are the platform CRM's", () => {
    const names = TOOLS.map((t) => t.name as string);
    for (const gone of ["create_lead", "advance_pipeline"]) expect(names).not.toContain(gone);
  });

  it("get_referral_link gives an active client its own stable link on this site, and refuses anyone else", async () => {
    const store = freshStore();
    const own = store.createClient({ name: "Our Agency", domain: "", contact: { name: "", email: "", role: "" } });
    const lead = store.createClient({ name: "Acme Dental", domain: "acmedental.example", contact: { name: "O", email: "o@acmedental.example", role: "" } });
    const ask = async (client = lead.id) => (await handleMcp(call("get_referral_link", { client }), store, null, "https://agency.example")) as CallResult;

    // The agency's own record and a churned client are not clients to ask.
    expect((await ask(own.id)).result.isError).toBe(true);
    const churned = (ACTIVE_TEMPLATE.seed.clients as Client[]).find((c) => c.stage === "churned");
    if (churned) expect((await ask(churned.id)).result.isError).toBe(true);

    const link = JSON.parse((await ask()).result.content[0]!.text) as { code: string; url: string };
    expect(link.url).toBe(`https://agency.example/?ref=${link.code}#contact`);
    // Random, never the slug, and the same every time it is asked for.
    expect(link.code).toMatch(/^[\w-]{12}$/);
    expect(link.code).not.toContain("acme");
    expect((JSON.parse((await ask()).result.content[0]!.text) as { code: string }).code).toBe(link.code);
  });

  it("stamps a link for a client onboarded before links existed", async () => {
    const store = freshStore();
    const lead = store.createClient({ name: "Old Client", domain: "old.example", contact: { name: "O", email: "o@old.example", role: "" } });
    delete (store.read().clients.find((c) => c.id === lead.id) as Client).referralCode;
    expect(store.referralCode(lead.id)).toMatch(/^[\w-]{12}$/);
  });

  describe("who is ready to be asked for a referral", () => {
    const now = new Date("2026-06-01T12:00:00Z");
    const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();
    const day = (n: number) => daysAgo(n).slice(0, 10);
    const client = (over: Partial<Client> = {}): Client => ({
      id: "cli_r", slug: "r", name: "R", domain: "r.example", stage: "active", services: [], contact: { name: "R", email: "r@r.example", role: "" }, notes: [],
      onboardedAt: daysAgo(45), ...over,
    });
    const post = (status: Post["status"], ago: number): Post => ({ id: `post_${status}_${ago}`, clientId: "cli_r", title: "t", summary: "s", kind: "article", channel: "blog", status, agent: "a", scheduledFor: day(ago), hue: 0 });
    const happy = [post("approved", 10), post("posted", 20)];

    it("asks a client with the agency a month, two pieces approved lately, nothing turned down and not asked lately", () => {
      expect(referralRefusal(client(), happy, now)).toBeNull();
    });

    it.each([
      ["the agency's own record", client({ domain: "", contact: { name: "", email: "", role: "" } }), happy, /agency's own record/],
      ["a churned client", client({ stage: "churned" }), happy, /only an active client/],
      ["a client of two weeks", client({ onboardedAt: daysAgo(14) }), happy, /after 30 days/],
      ["one approved piece", client(), [post("approved", 10)], /at least 2 pieces/],
      ["approvals older than 60 days", client(), [post("approved", 70), post("posted", 80)], /at least 2 pieces/],
      ["work turned down lately", client(), [...happy, post("rejected", 5)], /turned down work/],
      // A draft is turned down before its slot comes round: a future-slot rejection counts too.
      ["a draft for next week just turned down", client(), [...happy, post("rejected", -7)], /turned down work/],
      ["asked a month ago", client({ referralAskedAt: daysAgo(30) }), happy, /less than 90 days ago/],
    ])("does not ask %s", (_why, row, posts, reason) => {
      expect(referralRefusal(row, posts, now)).toMatch(reason);
    });

    it("asks again once the cooldown has passed", () => {
      expect(referralRefusal(client({ referralAskedAt: daysAgo(91) }), happy, now)).toBeNull();
    });
  });

  it("list_referral_ready names ready clients with their link, and record_referral_ask starts the cooldown", async () => {
    const store = freshStore();
    const ready = store.createClient({ name: "Happy Co", domain: "happy.example", contact: { name: "H", email: "h@happy.example", role: "" } });
    const row = store.read().clients.find((c) => c.id === ready.id)!;
    row.onboardedAt = new Date(Date.now() - 40 * 86_400_000).toISOString();
    const today = new Date().toISOString().slice(0, 10);
    for (const status of ["approved", "posted"] as const) {
      const draft = store.createDraftPost({ clientId: ready.id, title: status, summary: "s", kind: ACTIVE.kinds[0]!.id, channel: "blog", scheduledFor: today })!;
      store.updatePost(draft.id, { status });
    }
    const list = async () => JSON.parse(((await handleMcp(call("list_referral_ready", {}), store, null, "https://agency.example")) as CallResult).result.content[0]!.text) as { id: string; referral_link: string }[];

    const named = await list();
    expect(named.map((c) => c.id)).toContain(ready.id);
    expect(named.find((c) => c.id === ready.id)?.referral_link).toMatch(/^https:\/\/agency\.example\/\?ref=[\w-]{12}#contact$/);

    expect(((await handleMcp(call("record_referral_ask", { client: ready.id }), store, null)) as CallResult).result.isError).toBeFalsy();
    expect((await list()).map((c) => c.id)).not.toContain(ready.id);
    // A second ask inside the cooldown is refused with the reason.
    const again = (await handleMcp(call("record_referral_ask", { client: ready.id }), store, null)) as CallResult;
    expect([again.result.isError, again.result.content[0]!.text]).toEqual([true, expect.stringMatching(/less than 90 days ago/)]);
  });

  it("add_client_note files the note verbatim and restates the next action when given", async () => {
    const store = freshStore();
    const answer = (await handleMcp(call("add_client_note", {
      id: anyClient, note: "Kickoff: four articles a month, first audit by Friday.", next_action: "Reply to follow-up",
    }), store, null)) as CallResult;
    const client = JSON.parse(answer.result.content[0]!.text) as { notes: string[]; nextAction: string };
    expect(client.notes.at(-1)).toBe("Kickoff: four articles a month, first audit by Friday.");
    expect(client.nextAction).toBe("Reply to follow-up");
    expect(store.read().clients.find((c) => c.id === anyClient)?.nextAction).toBe("Reply to follow-up");
  });

  it("walks a post through draft → approve → schedule", async () => {
    const store = freshStore();
    const drafted = (await handleMcp(call("create_draft_post", {
      client: anyClient, title: "T", summary: "S", kind: ACTIVE.kinds[0]!.id, channel: "blog", scheduled_for: "2025-03-21",
    }), store, null)) as CallResult;
    const post = JSON.parse(drafted.result.content[0]!.text) as { id: string; status: string };
    expect(post.status).toBe("pending");
    await handleMcp(call("approve_post", { id: post.id }), store, null);
    await handleMcp(call("schedule_post", { id: post.id, date: "2025-03-25" }), store, null);
    const stored = store.read().posts.find((p) => p.id === post.id);
    expect(stored?.status).toBe("approved");
    expect(stored?.scheduledFor).toBe("2025-03-25");
  });

  /**
   * The operator approves the draft, not the line about the draft. Until the queue carried a body
   * there was nothing else to carry: a deliverable was judged from a one-line summary and no screen
   * anywhere could show more, so "approve" meant approving something nobody had read.
   */
  it("files the draft itself, and keeps a draft that has no body honest about it", async () => {
    const store = freshStore();
    const base = { client: anyClient, title: "T", summary: "S", kind: ACTIVE.kinds[0]!.id, channel: "blog", scheduled_for: "2025-03-21" };
    const withBody = (await handleMcp(call("create_draft_post", { ...base, body: "# Heading\n\nThe piece, in full." }), store, null)) as CallResult;
    expect((JSON.parse(withBody.result.content[0]!.text) as { body?: string }).body).toBe("# Heading\n\nThe piece, in full.");
    const without = (await handleMcp(call("create_draft_post", base), store, null)) as CallResult;
    expect(JSON.parse(without.result.content[0]!.text)).not.toHaveProperty("body");
  });

  /**
   * A product-design deliverable IS its files: a concept mesh and its still, a part's STEP + STL +
   * preview. The queue carries their `fil_` ids so the Studio screen can show them; anything that is
   * not one, or too many, is refused whole rather than filed without the file the agent meant.
   */
  it("files a studio deliverable with its fil_ ids, and refuses anything that is not one", async () => {
    const store = freshStore();
    const base = { client: anyClient, title: "Carafe", summary: "Concept + still", kind: ACTIVE.kinds[0]!.id, channel: "studio", scheduled_for: "2026-10-30" };
    const filed = (await handleMcp(call("create_draft_post", { ...base, files: ["fil_glb1", "fil_png1", "fil_glb1"] }), store, null)) as CallResult;
    expect(filed.result.isError).toBeUndefined();
    const post = JSON.parse(filed.result.content[0]!.text) as { id: string; channel: string; files: string[] };
    expect(post.channel).toBe("studio");
    expect(post.files).toEqual(["fil_glb1", "fil_png1"]);
    expect(store.read().posts.find((p) => p.id === post.id)?.files).toEqual(["fil_glb1", "fil_png1"]);
    // Filed today whatever day the seat sent: a studio deliverable is never scheduled.
    const guessed = (await handleMcp(call("create_draft_post", { ...base, scheduled_for: "2025-05-19" }), store, null)) as CallResult;
    expect((JSON.parse(guessed.result.content[0]!.text) as { scheduledFor: string }).scheduledFor).toBe(new Date().toISOString().slice(0, 10));
    // No files is a row with no `files` at all, as every word-only row has always been.
    const plain = (await handleMcp(call("create_draft_post", { ...base, files: [] }), store, null)) as CallResult;
    expect(JSON.parse(plain.result.content[0]!.text)).not.toHaveProperty("files");

    const before = store.read().posts.length;
    for (const [files, why] of [
      ["fil_glb1", /files must be a list of fil_ ids/],
      [["https://example.com/a.glb"], /only platform file ids \(fil_…\); refused: "https:\/\/example\.com\/a\.glb"/],
      [["fil_ok", "../fil_x"], /refused: "\.\.\/fil_x"/],
      [Array.from({ length: 9 }, (_, i) => `fil_${i}`), /at most 8 ids/],
    ] as const) {
      const refused = (await handleMcp(call("create_draft_post", { ...base, files }), store, null)) as CallResult;
      expect(refused.result.isError).toBe(true);
      expect(refused.result.content[0]!.text).toMatch(why);
    }
    const badChannel = (await handleMcp(call("create_draft_post", { ...base, channel: "tiktok" }), store, null)) as CallResult;
    expect(badChannel.result.isError).toBe(true);
    expect(badChannel.result.content[0]!.text).toBe("channel must be one of blog, linkedin, x, studio");
    expect(store.read().posts.length).toBe(before);
    // And the schema the agent reads says the same.
    const tool = TOOLS.find((t) => t.name === "create_draft_post")!;
    expect(tool.inputSchema.properties).toMatchObject({ files: { type: "array", maxItems: 8, items: { pattern: "^fil_[A-Za-z0-9]+$" } } });
  });

  it("filters list_posts and get_calendar by client, state and range", async () => {
    const store = freshStore();
    const ready = (await handleMcp(call("list_posts", { client: readyPost.clientId, state: "ready" }), store, null)) as CallResult;
    expect(JSON.parse(ready.result.content[0]!.text)).toHaveLength(
      seedPosts.filter((p) => p.clientId === readyPost.clientId && p.status === "ready").length,
    );
    const day = readyPost.scheduledFor;
    const week = (await handleMcp(call("get_calendar", { client: readyPost.clientId, from: day, to: day }), store, null)) as CallResult;
    const posts = JSON.parse(week.result.content[0]!.text) as { scheduledFor: string }[];
    expect(posts.every((p) => p.scheduledFor === day)).toBe(true);
    expect(posts.length).toBeGreaterThan(0);
  });

  it("get_site reads the page as served, and update_site replaces whole sections or nothing", async () => {
    const store = freshStore();
    const before = (await handleMcp(call("get_site", {}), store, null)) as CallResult;
    const page = JSON.parse(before.result.content[0]!.text) as { hero: { title: string }; pricing: unknown };
    expect(page).toEqual(store.site());
    const hero = { ...page.hero, title: "Paid social for skincare brands" };
    const updated = (await handleMcp(call("update_site", { site: { hero } }), store, null)) as CallResult;
    expect(updated.result.isError).toBeUndefined();
    expect(store.site().hero.title).toBe("Paid social for skincare brands");
    expect(store.site().pricing).toEqual(page.pricing);
    // A section outside the page, or one that lost its shape, is refused in words the builder can act on.
    const bad = (await handleMcp(call("update_site", { site: { testimonials: [] } }), store, null)) as CallResult;
    expect(bad.result.isError).toBe(true);
    expect(bad.result.content[0]!.text).toMatch(/^site must name only company, tagline, .*each in the shape get_site returns$/);
    expect(((await handleMcp(call("update_site", {}), store, null)) as CallResult).result.isError).toBe(true);
  });

  it("answers tool errors as isError results, not protocol errors", async () => {
    const store = freshStore();
    const missing = (await handleMcp(call("get_client", { id: "cli_missing" }), store, null)) as CallResult;
    expect(missing.result.isError).toBe(true);
    const offline = (await handleMcp(call("list_agents", {}), store, null)) as CallResult;
    expect(offline.result.isError).toBe(true);
    expect(offline.result.content[0]!.text).toBe("platform not configured on this server");
  });
});
