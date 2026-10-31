import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Client } from "../seed/clients";
import type { Post } from "../seed/posts";
import { ACTIVE } from "../templates/index";
import { ACTIVE_TEMPLATE } from "../templates/active";
import { kindApp, TOOLS_OF, type AppId } from "./apps";
import { authorized, handleMcp } from "./mcp";
import { openStore, referralRefusal, type Store } from "./store";

/** The seeded rows are the active template's, so they are named by what they are, never by id. */
const seedPosts = ACTIVE_TEMPLATE.seed.posts as Post[];
const anyClient = (ACTIVE_TEMPLATE.seed.clients as Client[])[0]!.id;
const readyPost = seedPosts.find((p) => p.status === "ready")!;

const dirs: string[] = [];
const freshStore = (app: AppId = "crm"): Store => {
  const dir = mkdtempSync(join(tmpdir(), "sga-mcp-"));
  dirs.push(dir);
  return openStore(join(dir, "store.json"), app);
};
const SITE = "https://agency.example";
/** One JSON-RPC message to `app`'s tools; the CRM unless a test says otherwise (ADR-1766). */
const mcp = (raw: string, store: Store, app: AppId = "crm") => handleMcp(raw, store, null, SITE, app);
/** The first kind the template files, and the app that files it. */
const KIND = ACTIVE.kinds[0]!.id;
const KIND_APP = kindApp(KIND);
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const rpc = (method: string, params?: unknown, id = 1) => JSON.stringify({ jsonrpc: "2.0", id, method, params });
const call = (name: string, args: Record<string, unknown>) => rpc("tools/call", { name, arguments: args });
type CallResult = { result: { content: { text: string }[]; isError?: boolean } };

describe("mcp auth", () => {
  it("takes the platform's bearer and nothing else", () => {
    const platform = "vmt_platform_minted_secret";
    expect(authorized(`Bearer ${platform}`, platform)).toBe(true);
    expect(authorized("Bearer vmt_platform_minted_secreT", platform)).toBe(false);
    expect(authorized("Bearer vmt_", platform)).toBe(false);
    expect(authorized(undefined, platform)).toBe(false);
    expect(authorized("Basic abc", platform)).toBe(false);
  });

  it("admits nobody when the token is unset or empty", () => {
    expect(authorized("Bearer anything", undefined)).toBe(false);
    expect(authorized("Bearer ", "")).toBe(false);
    expect(authorized("Bearer anything", "")).toBe(false);
  });
});

describe("mcp protocol", () => {
  it("answers initialize with the tools capability", async () => {
    const answer = (await mcp(rpc("initialize"), freshStore())) as {
      result: { capabilities: { tools: object }; serverInfo: { name: string } };
    };
    expect(answer.result.serverInfo.name).toBe("crm");
    expect(answer.result.capabilities.tools).toEqual({});
  });

  it("lists exactly each app's own tools, and calls none of another's", async () => {
    for (const app of ["crm", "landing-page", "seo-geo", "ads"] as const) {
      const answer = (await mcp(rpc("tools/list"), freshStore(app), app)) as { result: { tools: { name: string }[] } };
      expect(answer.result.tools.map((t) => t.name).sort()).toEqual([...TOOLS_OF[app]].sort());
    }
    const other = (await mcp(call("get_site", {}), freshStore(), "crm")) as CallResult;
    expect([other.result.isError, other.result.content[0]!.text]).toEqual([true, "unknown tool: get_site"]);
  });

  it("swallows notifications and rejects unknown methods", async () => {
    const store = freshStore();
    expect(await mcp(rpc("notifications/initialized"), store)).toBeNull();
    const bad = (await mcp(rpc("resources/list"), store)) as { error: { code: number } };
    expect(bad.error.code).toBe(-32601);
    const parse = (await mcp("not json", store)) as { error: { code: number } };
    expect(parse.error.code).toBe(-32700);
  });
});

describe("mcp tools", () => {
  it("create_lead mutates the same store the dashboard reads", async () => {
    const store = freshStore();
    const before = store.read().clients.length;
    const answer = (await mcp(call("create_lead", {
      name: "Pine & Post", domain: "pineandpost.example",
      contact_name: "Ada", contact_email: "ada@pineandpost.example", contact_role: "CEO",
      note: "Came in over MCP.",
    }), store)) as CallResult;
    const lead = JSON.parse(answer.result.content[0]!.text) as { id: string; stage: string; slug: string };
    expect(lead.stage).toBe("lead");
    expect(lead.slug).toBe("pine-post");
    expect(store.read().clients).toHaveLength(before + 1);
    expect(store.read().clients.at(-1)?.id).toBe(lead.id);
  });

  it("create_lead needs only a name: the agency's own record is filed without a contact to ask for", async () => {
    const store = freshStore();
    const answer = (await mcp(call("create_lead", { name: "Northwind Studio" }), store)) as CallResult;
    const lead = JSON.parse(answer.result.content[0]!.text) as { id: string; domain: string; contact: { email: string } };
    expect(lead.domain).toBe("");
    expect(lead.contact.email).toBe("");
    expect(store.read().clients.at(-1)?.id).toBe(lead.id);
  });

  it("create_lead records where a lead came from: outreach by default, network when said, a referral only from a real client", async () => {
    const store = freshStore();
    const file = async (args: Record<string, unknown>) => (await mcp(call("create_lead", { contact_email: "a@x.example", ...args }), store)) as CallResult;
    const lead = (answer: CallResult) => JSON.parse(answer.result.content[0]!.text) as Client;

    expect(lead(await file({ name: "Prospect Co", domain: "prospect.example" })).source).toBe("outreach");
    expect(lead(await file({ name: "Old Boss LLC", domain: "oldboss.example", source: "network" })).source).toBe("network");
    const referred = lead(await file({ name: "Friend Of Acme", domain: "friend.example", referred_by: anyClient }));
    expect([referred.source, referred.referredBy]).toEqual(["referral", anyClient]);

    // A referral must name a client that exists, and an agent may not claim a form's source.
    expect((await file({ name: "Ghost", domain: "ghost.example", source: "referral", referred_by: "cli_nobody" })).result.isError).toBe(true);
    expect((await file({ name: "Ghost", domain: "ghost.example", source: "referral" })).result.isError).toBe(true);
    // `site` is the sales seat filing the landing page's lead (ADR-1766); `manual` stays the CRM form's.
    expect(lead(await file({ name: "From The Form", domain: "form.example", source: "site" })).source).toBe("site");
    expect((await file({ name: "Sneaky", domain: "sneaky.example", source: "manual" })).result.isError).toBe(true);
    expect((await file({ name: "Mixed", domain: "mixed.example", source: "network", referred_by: anyClient })).result.isError).toBe(true);
    // A prospect still at the lead stage, or the agency's own record, is not a client who can refer.
    const prospect = (ACTIVE_TEMPLATE.seed.clients as Client[]).find((c) => c.stage === "lead")!.id;
    expect((await file({ name: "Via Prospect", domain: "vp.example", referred_by: prospect })).result.isError).toBe(true);
    const agency = lead(await file({ name: "Our Agency" })).id;
    expect((await file({ name: "Via Agency", domain: "va.example", referred_by: agency })).result.isError).toBe(true);
  });

  it("get_referral_link gives an active client its own stable link on this site, and refuses anyone else", async () => {
    const store = freshStore();
    const lead = store.createLead({ name: "Acme Dental", domain: "acmedental.example", contact: { name: "O", email: "o@acmedental.example", role: "" } });
    const ask = async () => (await mcp(call("get_referral_link", { client: lead.id, site_url: SITE }), store)) as CallResult;

    // A lead is not yet a client the agency works for.
    expect((await ask()).result.isError).toBe(true);

    store.onboardClient(lead.id);
    const link = JSON.parse((await ask()).result.content[0]!.text) as { code: string; url: string };
    expect(link.url).toBe(`https://agency.example/?ref=${link.code}#contact`);
    // Random, never the slug, and the same every time it is asked for.
    expect(link.code).toMatch(/^[\w-]{12}$/);
    expect(link.code).not.toContain("acme");
    expect((JSON.parse((await ask()).result.content[0]!.text) as { code: string }).code).toBe(link.code);
  });

  it("stamps a link for a client onboarded before links existed", async () => {
    const store = freshStore();
    const lead = store.createLead({ name: "Old Client", domain: "old.example", contact: { name: "O", email: "o@old.example", role: "" } });
    store.onboardClient(lead.id);
    delete (store.read().clients.find((c) => c.id === lead.id) as Client).referralCode;
    expect(store.referralCode(lead.id)).toMatch(/^[\w-]{12}$/);
  });

  describe("who is ready to be asked for a referral", () => {
    const now = new Date("2026-06-01T12:00:00Z");
    const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();
    const client = (over: Partial<Client> = {}): Client => ({
      id: "cli_r", slug: "r", name: "R", domain: "r.example", stage: "active", services: [], contact: { name: "R", email: "r@r.example", role: "" }, notes: [],
      onboardedAt: daysAgo(45), ...over,
    });

    it("asks a client with the agency a month and not asked lately", () => {
      expect(referralRefusal(client(), now)).toBeNull();
    });

    it.each([
      ["a lead", client({ stage: "lead" }), /only an active client/],
      ["a churned client", client({ stage: "churned" }), /only an active client/],
      ["a client of two weeks", client({ onboardedAt: daysAgo(14) }), /after 30 days/],
      ["asked a month ago", client({ referralAskedAt: daysAgo(30) }), /less than 90 days ago/],
    ])("does not ask %s", (_why, row, reason) => {
      expect(referralRefusal(row, now)).toMatch(reason);
    });

    it("asks again once the cooldown has passed", () => {
      expect(referralRefusal(client({ referralAskedAt: daysAgo(91) }), now)).toBeNull();
    });
  });

  it("list_referral_ready names ready clients with their link, and record_referral_ask starts the cooldown", async () => {
    const store = freshStore();
    const ready = store.createLead({ name: "Happy Co", domain: "happy.example", contact: { name: "H", email: "h@happy.example", role: "" } });
    store.onboardClient(ready.id);
    const row = store.read().clients.find((c) => c.id === ready.id)!;
    row.onboardedAt = new Date(Date.now() - 40 * 86_400_000).toISOString();
    const list = async () => JSON.parse(((await mcp(call("list_referral_ready", { site_url: SITE }), store)) as CallResult).result.content[0]!.text) as { id: string; referral_link: string }[];

    const named = await list();
    expect(named.map((c) => c.id)).toContain(ready.id);
    expect(named.find((c) => c.id === ready.id)?.referral_link).toMatch(/^https:\/\/agency\.example\/\?ref=[\w-]{12}#contact$/);

    expect(((await mcp(call("record_referral_ask", { client: ready.id }), store)) as CallResult).result.isError).toBeFalsy();
    expect((await list()).map((c) => c.id)).not.toContain(ready.id);
    // A second ask inside the cooldown is refused with the reason.
    const again = (await mcp(call("record_referral_ask", { client: ready.id }), store)) as CallResult;
    expect([again.result.isError, again.result.content[0]!.text]).toEqual([true, expect.stringMatching(/less than 90 days ago/)]);
  });

  it("the agency's own name-only record carries no source: it is not a lead", async () => {
    const store = freshStore();
    const answer = (await mcp(call("create_lead", { name: "Northwind Studio", source: "network" }), store)) as CallResult;
    expect((JSON.parse(answer.result.content[0]!.text) as Client).source).toBeUndefined();
  });

  it("add_client_note files the note verbatim and restates the next action when given", async () => {
    const store = freshStore();
    const answer = (await mcp(call("add_client_note", {
      id: anyClient, note: "Drafted follow-up: are you still weighing the proposal?", next_action: "Reply to follow-up",
    }), store)) as CallResult;
    const client = JSON.parse(answer.result.content[0]!.text) as { notes: string[]; nextAction: string };
    expect(client.notes.at(-1)).toBe("Drafted follow-up: are you still weighing the proposal?");
    expect(client.nextAction).toBe("Reply to follow-up");
    expect(store.read().clients.find((c) => c.id === anyClient)?.nextAction).toBe("Reply to follow-up");
  });

  it("walks a post through draft → approve → schedule", async () => {
    const store = freshStore();
    const drafted = (await mcp(call("create_draft_post", {
      client: anyClient, title: "T", summary: "S", kind: KIND, channel: "blog", scheduled_for: "2025-03-21",
    }), store, KIND_APP)) as CallResult;
    const post = JSON.parse(drafted.result.content[0]!.text) as { id: string; status: string };
    expect(post.status).toBe("pending");
    await mcp(call("approve_post", { id: post.id }), store, KIND_APP);
    await mcp(call("schedule_post", { id: post.id, date: "2025-03-25" }), store, KIND_APP);
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
    const base = { client: anyClient, title: "T", summary: "S", kind: KIND, channel: "blog", scheduled_for: "2025-03-21" };
    const withBody = (await mcp(call("create_draft_post", { ...base, body: "# Heading\n\nThe piece, in full." }), store, KIND_APP)) as CallResult;
    expect((JSON.parse(withBody.result.content[0]!.text) as { body?: string }).body).toBe("# Heading\n\nThe piece, in full.");
    const without = (await mcp(call("create_draft_post", base), store, KIND_APP)) as CallResult;
    expect(JSON.parse(without.result.content[0]!.text)).not.toHaveProperty("body");
  });

  it("filters list_posts and get_calendar by client, state and range", async () => {
    const app = kindApp(readyPost.kind);
    const store = freshStore(app);
    const ready = (await mcp(call("list_posts", { client: readyPost.clientId, state: "ready" }), store, app)) as CallResult;
    expect(JSON.parse(ready.result.content[0]!.text)).toHaveLength(
      seedPosts.filter((p) => p.clientId === readyPost.clientId && p.status === "ready").length,
    );
    const day = readyPost.scheduledFor;
    const week = (await mcp(call("get_calendar", { client: readyPost.clientId, from: day, to: day }), store, app)) as CallResult;
    const posts = JSON.parse(week.result.content[0]!.text) as { scheduledFor: string }[];
    expect(posts.every((p) => p.scheduledFor === day)).toBe(true);
    expect(posts.length).toBeGreaterThan(0);
  });

  it("get_site reads the page as served with its address, and update_site replaces whole sections or nothing", async () => {
    const store = freshStore("landing-page");
    const site = (raw: string) => mcp(raw, store, "landing-page");
    const before = (await site(call("get_site", {}))) as CallResult;
    const page = JSON.parse(before.result.content[0]!.text) as { hero: { title: string }; pricing: unknown };
    expect(page).toEqual({ ...store.site(), url: SITE });
    const hero = { ...page.hero, title: "Paid social for skincare brands" };
    const updated = (await site(call("update_site", { site: { hero } }))) as CallResult;
    expect(updated.result.isError).toBeUndefined();
    expect(store.site().hero.title).toBe("Paid social for skincare brands");
    expect(store.site().pricing).toEqual(page.pricing);
    // A section outside the page, or one that lost its shape, is refused in words the builder can act on.
    const bad = (await site(call("update_site", { site: { testimonials: [] } }))) as CallResult;
    expect(bad.result.isError).toBe(true);
    expect(bad.result.content[0]!.text).toMatch(/^site must name only company, tagline, .*each in the shape get_site returns$/);
    expect(((await site(call("update_site", {}))) as CallResult).result.isError).toBe(true);
  });

  it("answers tool errors as isError results, not protocol errors", async () => {
    const store = freshStore();
    const missing = (await mcp(call("get_client", { id: "cli_missing" }), store)) as CallResult;
    expect(missing.result.isError).toBe(true);
    const offline = (await mcp(call("get_client_crew", { client: anyClient }), store)) as CallResult;
    expect(offline.result.isError).toBe(true);
    expect(offline.result.content[0]!.text).toBe("this app cannot read the agents yet: the platform has not given it a key");
  });

  it("files a kind only in the app that files it", async () => {
    const other = (["crm", "seo-geo", "ads", "landing-page"] as const).find((app) => app !== KIND_APP)!;
    const wrong = (await mcp(call("create_draft_post", { client: anyClient, title: "T", summary: "S", kind: KIND, channel: "blog", scheduled_for: "2025-03-21" }), freshStore(other), other)) as CallResult;
    expect([wrong.result.isError, wrong.result.content[0]!.text]).toEqual([true, `kind "${KIND}" is filed in ${KIND_APP}, not ${other}: use ${KIND_APP}.create_draft_post`]);
    const unknown = (await mcp(call("create_draft_post", { client: anyClient, title: "T", summary: "S", kind: "nope", channel: "blog", scheduled_for: "2025-03-21" }), freshStore(other), other)) as CallResult;
    expect(unknown.result.content[0]!.text).toMatch(/^kind must be one of /);
  });

  it("files work for a CRM client outside the CRM, keeping the name the agent gave", async () => {
    if (KIND_APP === "crm") return;
    const answer = (await mcp(call("create_draft_post", { client: "cli_elsewhere", client_name: "Acme", title: "T", summary: "S", kind: KIND, channel: "blog", scheduled_for: "2025-03-21" }), freshStore(KIND_APP), KIND_APP)) as CallResult;
    expect(JSON.parse(answer.result.content[0]!.text)).toMatchObject({ clientId: "cli_elsewhere", clientName: "Acme", status: "pending" });
  });
});

describe("the lead inbox: landing page to CRM through the sales seat (ADR-1766)", () => {
  it("lists unfiled leads until each is marked filed, and marking twice is the same", async () => {
    const store = freshStore("landing-page");
    const lead = store.createLead({ name: "Pine", domain: "pine.example", contact: { name: "A", email: "a@pine.example", role: "" }, source: "site", ref: "abc123" });
    const listed = async () => JSON.parse(((await mcp(call("list_new_leads", {}), store, "landing-page")) as CallResult).result.content[0]!.text) as Client[];
    expect((await listed()).map((c) => [c.id, c.ref])).toContainEqual([lead.id, "abc123"]);
    for (let i = 0; i < 2; i += 1) {
      const marked = (await mcp(call("mark_lead_filed", { id: lead.id }), store, "landing-page")) as CallResult;
      expect(JSON.parse(marked.result.content[0]!.text)).toEqual({ ok: true, id: lead.id });
    }
    expect((await listed()).map((c) => c.id)).not.toContain(lead.id);
  });

  it("files a lead's referral code in the CRM as that client's referral, and an unknown code as a site lead", async () => {
    const store = freshStore();
    const referrer = store.createLead({ name: "Acme Dental", domain: "acmedental.example", contact: { name: "O", email: "o@acmedental.example", role: "" } });
    store.onboardClient(referrer.id);
    const code = store.referralCode(referrer.id)!;
    const file = async (args: Record<string, unknown>) => JSON.parse(((await mcp(call("create_lead", { contact_email: "v@x.example", ...args }), store)) as CallResult).result.content[0]!.text) as Client;
    expect(await file({ name: "Friend", domain: "friend.example", ref: code })).toMatchObject({ source: "referral", referredBy: referrer.id });
    expect(await file({ name: "Stranger", domain: "stranger.example", ref: "nope" })).toMatchObject({ source: "site" });
  });
});

describe("onboarding through the CEO (ADR-1766)", () => {
  it("records the hire: the client becomes active and the request is cleared", async () => {
    const store = freshStore();
    const lead = store.createLead({ name: "Acme", domain: "acme.example", contact: { name: "A", email: "a@acme.example", role: "" } });
    store.requestOnboarding(lead.id);
    const done = (await mcp(call("record_onboarding", { client: lead.id, agents: [] }), store)) as CallResult;
    const client = JSON.parse(done.result.content[0]!.text) as Client;
    expect(client.stage).toBe("active");
    expect(client).not.toHaveProperty("onboardingRequestedAt");
  });
});

describe("the calendar app (ADR-1766)", () => {
  const cal = (raw: string, store: Store) => mcp(raw, store, "calendar");
  const out = (r: unknown) => JSON.parse((r as CallResult).result.content[0]!.text);

  it("puts meetings and deliverable due days on the calendar, soonest first, and filters them", async () => {
    const store = freshStore("calendar");
    store.read().events = [];
    await cal(call("create_event", { kind: "deliverable", title: "Audit due", client: "cli_1", client_name: "Acme", start: "2026-11-10", app: "seo-geo", ref: "post_9" }), store);
    await cal(call("create_event", { kind: "meeting", title: "Kickoff", client: "cli_1", start: "2026-11-04T15:00:00Z", where: "Video call" }), store);
    const all = out(await cal(call("list_events", {}), store)) as { title: string }[];
    expect(all.map((e) => e.title)).toEqual(["Kickoff", "Audit due"]);
    expect(out(await cal(call("list_events", { kind: "deliverable" }), store))).toEqual([expect.objectContaining({ app: "seo-geo", ref: "post_9", clientName: "Acme", status: "scheduled" })]);
    expect(out(await cal(call("list_events", { from: "2026-11-05" }), store)).map((e: { title: string }) => e.title)).toEqual(["Audit due"]);
  });

  it("refuses a kind, a date or an app it does not know, and marks an event done", async () => {
    const store = freshStore("calendar");
    for (const bad of [{ kind: "party" }, { start: "next tuesday" }, { app: "billing" }]) {
      const r = (await cal(call("create_event", { kind: "meeting", title: "t", client: "cli_1", start: "2026-11-04", ...bad }), store)) as CallResult;
      expect(r.result.isError).toBe(true);
    }
    const made = out(await cal(call("create_event", { kind: "meeting", title: "t", client: "cli_1", start: "2026-11-04" }), store)) as { id: string };
    expect(out(await cal(call("update_event", { id: made.id, status: "done" }), store))).toMatchObject({ status: "done" });
    expect(((await cal(call("update_event", { id: made.id, status: "maybe" }), store)) as CallResult).result.isError).toBe(true);
  });

  it("seeds each demo deliverable on its due day, pointing at the app that holds it", () => {
    const events = freshStore("calendar").read().events ?? [];
    const due = events.filter((e) => e.kind === "deliverable");
    expect(due.length).toBe(seedPosts.length);
    for (const e of due) expect(e.app).toBe(kindApp(seedPosts.find((p) => p.id === e.ref)!.kind));
  });
});
