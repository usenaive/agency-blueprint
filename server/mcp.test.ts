import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Client } from "../seed/clients";
import type { Post } from "../seed/posts";
import { ACTIVE } from "../templates/index";
import { ACTIVE_TEMPLATE } from "../templates/active";
import { authorized, handleMcp, mintToken, TOOLS } from "./mcp";
import { openStore, type Store } from "./store";

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
  it("create_lead mutates the same store the dashboard reads", async () => {
    const store = freshStore();
    const before = store.read().clients.length;
    const answer = (await handleMcp(call("create_lead", {
      name: "Pine & Post", domain: "pineandpost.example",
      contact_name: "Ada", contact_email: "ada@pineandpost.example", contact_role: "CEO",
      note: "Came in over MCP.",
    }), store, null)) as CallResult;
    const lead = JSON.parse(answer.result.content[0]!.text) as { id: string; stage: string; slug: string };
    expect(lead.stage).toBe("lead");
    expect(lead.slug).toBe("pine-post");
    expect(store.read().clients).toHaveLength(before + 1);
    expect(store.read().clients.at(-1)?.id).toBe(lead.id);
  });

  it("create_lead needs only a name: the agency's own record is filed without a contact to ask for", async () => {
    const store = freshStore();
    const answer = (await handleMcp(call("create_lead", { name: "Northwind Studio" }), store, null)) as CallResult;
    const lead = JSON.parse(answer.result.content[0]!.text) as { id: string; domain: string; contact: { email: string } };
    expect(lead.domain).toBe("");
    expect(lead.contact.email).toBe("");
    expect(store.read().clients.at(-1)?.id).toBe(lead.id);
  });

  it("create_lead records where a lead came from: outreach by default, network when said, a referral only from a real client", async () => {
    const store = freshStore();
    const file = async (args: Record<string, unknown>) => (await handleMcp(call("create_lead", { contact_email: "a@x.example", ...args }), store, null)) as CallResult;
    const lead = (answer: CallResult) => JSON.parse(answer.result.content[0]!.text) as Client;

    expect(lead(await file({ name: "Prospect Co", domain: "prospect.example" })).source).toBe("outreach");
    expect(lead(await file({ name: "Old Boss LLC", domain: "oldboss.example", source: "network" })).source).toBe("network");
    const referred = lead(await file({ name: "Friend Of Acme", domain: "friend.example", referred_by: anyClient }));
    expect([referred.source, referred.referredBy]).toEqual(["referral", anyClient]);

    // A referral must name a client that exists, and an agent may not claim a form's source.
    expect((await file({ name: "Ghost", domain: "ghost.example", source: "referral", referred_by: "cli_nobody" })).result.isError).toBe(true);
    expect((await file({ name: "Ghost", domain: "ghost.example", source: "referral" })).result.isError).toBe(true);
    expect((await file({ name: "Sneaky", domain: "sneaky.example", source: "site" })).result.isError).toBe(true);
    expect((await file({ name: "Mixed", domain: "mixed.example", source: "network", referred_by: anyClient })).result.isError).toBe(true);
  });

  it("get_referral_link gives an active client its own stable link on this site, and refuses anyone else", async () => {
    const store = freshStore();
    const lead = store.createLead({ name: "Acme Dental", domain: "acmedental.example", contact: { name: "O", email: "o@acmedental.example", role: "" } });
    const ask = async () => (await handleMcp(call("get_referral_link", { client: lead.id }), store, null, "https://agency.example")) as CallResult;

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

  it("the agency's own name-only record carries no source: it is not a lead", async () => {
    const store = freshStore();
    const answer = (await handleMcp(call("create_lead", { name: "Northwind Studio", source: "network" }), store, null)) as CallResult;
    expect((JSON.parse(answer.result.content[0]!.text) as Client).source).toBeUndefined();
  });

  it("add_client_note files the note verbatim and restates the next action when given", async () => {
    const store = freshStore();
    const answer = (await handleMcp(call("add_client_note", {
      id: anyClient, note: "Drafted follow-up: are you still weighing the proposal?", next_action: "Reply to follow-up",
    }), store, null)) as CallResult;
    const client = JSON.parse(answer.result.content[0]!.text) as { notes: string[]; nextAction: string };
    expect(client.notes.at(-1)).toBe("Drafted follow-up: are you still weighing the proposal?");
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
