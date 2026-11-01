/**
 * The route table, tested without a socket or a database — which is the reason it moved out of
 * `server/index.ts`. Both callers (`pnpm serve` and the deployed function) run exactly this.
 */
import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { handleRequest, isLoopback, OPEN_LEADS_CAP, type ApiContext, type ApiRequest } from "./routes.ts";
import { LEAD_WINDOW_MS, LEADS_PER_WINDOW } from "./store.ts";
import { ACTIVE_TEMPLATE } from "../templates/active.ts";
import { emptyState, openStoreOver, type Store, type StoreState } from "./store.ts";

afterEach(() => vi.unstubAllGlobals());

const lead = {
  name: "Summit Outdoor Co",
  domain: "summitoutdoor.example",
  contact: { name: "Jordan Lee", email: "jordan@summitoutdoor.example", role: "Founder" },
};

function fixture(overrides: Partial<ApiContext> = {}) {
  const state: StoreState = emptyState();
  let writes = 0;
  const store: Store = openStoreOver(state, () => { writes += 1; });
  const ctx: ApiContext = {
    // The CRM by default; a test of another app's rows says which (ADR-1766).
    app: "crm",
    store: () => Promise.resolve(store),
    config: null,
    mcpToken: "platform-token",
    // Unset by default, with `local: true`: `pnpm serve` for development is the one place the
    // `/api/*` gate is allowed to stand open, and every store test below is that case.
    dashboardToken: undefined,
    // Likewise unset: no password door, and no studio for the gate screen to send a browser to.
    dashboardPassword: undefined,
    studioUrl: undefined,
    appId: undefined,
    local: true,
    ...overrides,
  };
  const call = (method: string, path: string, body: unknown = "", headers: Record<string, string> = {}) => {
    const [pathname = path, search = ""] = path.split("?");
    const req: ApiRequest = {
      method,
      path: pathname,
      query: new URLSearchParams(search),
      headers,
      body: typeof body === "string" ? body : JSON.stringify(body),
    };
    return handleRequest(req, ctx);
  };
  return { call, state, store, writes: () => writes };
}

const rpc = (method: string, params?: unknown) => JSON.stringify({ jsonrpc: "2.0", id: 1, method, params });

describe("the store routes", () => {
  it("answers the app's own rows, and a fresh document is empty", async () => {
    const { call } = fixture();
    expect(await call("GET", "/api/clients")).toEqual({ status: 200, body: [] });
    expect(await call("GET", "/api/posts")).toEqual({ status: 200, body: [] });
  });

  it("files a lead, persists it, and refuses one that is missing its contact", async () => {
    const { call, writes } = fixture({ app: "landing-page" });
    const created = await call("POST", "/api/leads", lead);
    expect(created.status).toBe(201);
    // Two: the rate window's count and the row itself. Both are the same document, so the deployed
    // entry still writes it back once — `save()` there only marks the request dirty.
    expect(writes()).toBe(2);
    expect((await call("GET", "/api/clients")).body).toHaveLength(1);

    expect(await call("POST", "/api/leads", { name: "x" })).toEqual({
      status: 400,
      body: { error: "name, domain and contact {name, email} are required" },
    });
    // A body that is not JSON at all is a validation error, never a 502.
    expect((await call("POST", "/api/leads", "{oops")).status).toBe(400);
  });

  it("says a lead came from the site, whatever the body claims; only the CRM's own form says manual", async () => {
    const site = fixture({ app: "landing-page", dashboardToken: "dash-secret", local: false });
    await site.call("POST", "/api/leads", { ...lead, source: "referral", referredBy: "cli_victim" });
    expect(site.state.clients.at(-1)).toMatchObject({ source: "site" });
    expect(site.state.clients.at(-1)?.referredBy).toBeUndefined();
    // Signed in or not: the landing page's form is the public one.
    await site.call("POST", "/api/leads", { ...lead, contact: { ...lead.contact, email: "c@summitoutdoor.example" }, source: "manual" }, { authorization: "Bearer dash-secret" });
    expect(site.state.clients.at(-1)).toMatchObject({ source: "site" });

    const crm = fixture({ dashboardToken: "dash-secret", local: false });
    expect((await crm.call("POST", "/api/clients", lead)).status).toBe(401);
    expect((await crm.call("POST", "/api/clients", lead, { authorization: "Bearer dash-secret" })).status).toBe(201);
    expect(crm.state.clients.at(-1)).toMatchObject({ source: "manual", stage: "lead" });
    expect((await crm.call("POST", "/api/clients", { name: "x" }, { authorization: "Bearer dash-secret" })).status).toBe(400);
  });

  it("keeps a referral link's code on the lead for the CRM to resolve, since the clients are the CRM's", async () => {
    const { call, state } = fixture({ app: "landing-page", dashboardToken: "dash-secret", local: false });
    // A visitor's reply is the id alone either way, so it does not tell a good code from a bad one.
    const sent = await call("POST", "/api/leads", { ...lead, ref: "abc123" });
    expect(state.clients.at(-1)).toMatchObject({ source: "site", ref: "abc123" });
    expect(sent.body).toEqual({ id: state.clients.at(-1)!.id });
    await call("POST", "/api/leads", { ...lead, contact: { ...lead.contact, email: "x@summitoutdoor.example" }, ref: "x".repeat(65) });
    expect(state.clients.at(-1)).not.toHaveProperty("ref");
  });

  it("puts a referral-link lead through the same rate limit as every other public lead", async () => {
    const { call } = fixture({ app: "landing-page" });
    const ref = "abc123";
    for (let i = 0; i < LEADS_PER_WINDOW; i += 1) {
      await call("POST", "/api/leads", { ...lead, contact: { ...lead.contact, email: `r${i}@summitoutdoor.example` }, ref });
    }
    expect((await call("POST", "/api/leads", { ...lead, contact: { ...lead.contact, email: "late@summitoutdoor.example" }, ref })).status).toBe(429);
  });

  it("stores only the form's fields, and gives a visitor the lead's id rather than the CRM row", async () => {
    const { call, state } = fixture({ app: "landing-page", dashboardToken: "dash-secret", local: false });
    const posted = await call("POST", "/api/leads", { ...lead, extra: "x", contact: { ...lead.contact, blob: "y".repeat(5000) } });
    expect(posted.status).toBe(201);
    const row = state.clients.at(-1)!;
    expect(posted.body).toEqual({ id: row.id });
    expect(row.contact).toEqual(lead.contact);
    expect(row).not.toHaveProperty("extra");
    // The dedupe reply is the id too: it never shows a visitor the agency's notes on that lead.
    row.notes.push("internal: budget is tight");
    expect(await call("POST", "/api/leads", lead)).toEqual({ status: 200, body: { id: row.id } });
    // The signed-in operator's form still gets the full row.
    expect((await call("POST", "/api/leads", lead, { authorization: "Bearer dash-secret" })).body).toMatchObject({ id: row.id, notes: ["internal: budget is tight"] });
  });

  it("calls the platform for nothing when a public lead lands: the sales seat files it into the CRM", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const { call, store } = fixture({
      app: "landing-page",
      config: { baseUrl: "https://api.example", apiKey: "secret", identityId: "idn_1", project: "agency" },
    });
    expect((await call("POST", "/api/leads", lead)).status).toBe(201);
    expect(store.read().clients).toHaveLength(1);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("bounds what the anonymous form may write: one open row per contact, a cap on open leads, a size on fields", async () => {
    const { call, writes, store } = fixture({ app: "landing-page" });
    expect((await call("POST", "/api/leads", lead)).status).toBe(201);
    // The same contact again, however it is cased, is the row already filed — not a second write.
    const again = await call("POST", "/api/leads", { ...lead, contact: { ...lead.contact, email: "Jordan@SummitOutdoor.example " } });
    expect(again.status).toBe(200);
    // Still the two the first lead cost: a repeat is neither a row nor a count against the window.
    expect(writes()).toBe(2);
    // Once the contact is worked past "lead" the address may file a new one.
    store.advanceClient((again.body as { id: string }).id);
    expect((await call("POST", "/api/leads", lead)).status).toBe(201);

    expect((await call("POST", "/api/leads", { ...lead, note: "x".repeat(2001) })).status).toBe(400);
    expect((await call("POST", "/api/leads", { ...lead, services: Array.from({ length: 11 }, () => "seo") })).status).toBe(400);

    for (let i = store.read().clients.filter((c) => c.stage === "lead").length; i < OPEN_LEADS_CAP; i += 1) {
      store.createLead({ ...lead, domain: `d${i}.example`, contact: { ...lead.contact, email: `p${i}@d${i}.example` } });
    }
    const full = await call("POST", "/api/leads", { ...lead, domain: "late.example", contact: { ...lead.contact, email: "late@late.example" } });
    expect(full.status).toBe(429);
    expect(full.headers?.["retry-after"]).toBe("86400");
    expect(store.read().clients).toHaveLength(OPEN_LEADS_CAP + 1);
  });

  /**
   * The cap alone bounds spend, not availability: 200 scripted pairs used to fill the inbox in one
   * burst and every real lead for the next twenty-four hours was answered `429`. No agent turn
   * fires on a lead, so what that costs is business, not money — which is why the answer is a rate
   * and its `retry-after` is an hour, not the inbox-full day.
   */
  it("rate-limits the anonymous form, so a burst cannot hold the inbox shut for a day", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(0);
      const { call, store } = fixture({ app: "landing-page" });
      const file = (i: number) =>
        call("POST", "/api/leads", { ...lead, domain: `d${i}.example`, contact: { ...lead.contact, email: `p${i}@d${i}.example` } });
      for (let i = 0; i < LEADS_PER_WINDOW; i += 1) expect((await file(i)).status).toBe(201);

      const limited = await file(LEADS_PER_WINDOW);
      expect(limited.status).toBe(429);
      expect(limited.headers?.["retry-after"]).toBe(String(LEAD_WINDOW_MS / 1000));
      expect(store.read().clients).toHaveLength(LEADS_PER_WINDOW);

      // The next window admits again — the form is shut for an hour, never for the day.
      vi.setSystemTime(LEAD_WINDOW_MS);
      expect((await file(LEADS_PER_WINDOW)).status).toBe(201);
    } finally {
      vi.useRealTimers();
    }
  });

  it("advances, onboards, and refuses to onboard a churned client", async () => {
    const { call, store } = fixture();
    const client = store.createLead(lead);
    expect(((await call("POST", `/api/clients/${client.id}/advance`)).body as { stage: string }).stage).toBe("proposal");
    const onboarded = await call("POST", `/api/clients/${client.id}/onboard`);
    expect(onboarded.status).toBe(200);
    // This app hires nobody (ADR-1766): a template with a team asks the CEO, and the client goes
    // active only when the CEO records it; with no team there is nothing to hire.
    if (ACTIVE_TEMPLATE.crew.length === 0) {
      expect(onboarded.body).toEqual({ client: expect.objectContaining({ stage: "active" }), draft: null, url: null });
    } else {
      expect(onboarded.body).toMatchObject({ client: { stage: "proposal", onboardingRequestedAt: expect.any(String) }, draft: expect.stringContaining(`crm.get_client_crew for ${client.id}`), url: null });
    }

    client.stage = "churned";
    expect(await call("POST", `/api/clients/${client.id}/onboard`)).toEqual({
      status: 409,
      body: { error: "a churned client cannot be onboarded" },
    });
    expect(await call("POST", "/api/clients/cli_missing/advance")).toEqual({
      status: 404,
      body: { error: "no such client" },
    });
  });

  it("patches a post, and says which of the two things it needed", async () => {
    const { call, store } = fixture();
    const client = store.createLead(lead);
    const post = store.createDraftPost({
      clientId: client.id, title: "t", summary: "s", body: "A complete, reviewed article.", kind: "article", channel: "blog", scheduledFor: "2026-01-05",
    })!;
    expect(((await call("PATCH", `/api/posts/${post.id}`, { status: "approved" })).body as { status: string }).status).toBe("approved");
    expect(await call("PATCH", `/api/posts/${post.id}`, {})).toEqual({
      status: 400,
      body: { error: "status or scheduledFor is required" },
    });
    expect(await call("PATCH", "/api/posts/post_missing", { status: "ready" })).toEqual({
      status: 404,
      body: { error: "no such post" },
    });
    // Without a key the publish is skipped, but the queue still moves.
    expect(((await call("POST", `/api/posts/${post.id}/post-now`)).body as { status: string }).status).toBe("posted");
  });

  it("publishes a blog article to the public feed without calling the social publisher", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const { call, store } = fixture({
      app: "landing-page",
      config: { baseUrl: "https://api.example", apiKey: "secret", identityId: "idn_1", project: "agency" },
    });
    const client = store.createLead(lead);
    const draft = store.createDraftPost({
      clientId: client.id, title: "GEO basics", summary: "A practical definition", body: "Full article",
      kind: "article", channel: "blog", scheduledFor: "2026-09-26",
    })!;
    expect((await call("GET", "/api/blog")).body).toEqual([]);
    expect((await call("POST", `/api/posts/${draft.id}/post-now`)).status).toBe(200);
    expect(await call("GET", "/api/blog")).toMatchObject({
      status: 200,
      body: [{ id: draft.id, title: "GEO basics", body: "Full article" }],
      headers: { "cache-control": "public, max-age=60" },
    });
    expect(upstream).not.toHaveBeenCalled();

    const unsafe = store.createDraftPost({
      clientId: client.id, title: "Industry benchmark", summary: "A 35% result with no source",
      body: "Our clients get this result in the first two weeks.", kind: "article", channel: "blog", scheduledFor: "2026-09-27",
    })!;
    expect(await call("POST", `/api/posts/${unsafe.id}/post-now`)).toEqual({
      status: 409,
      body: { error: expect.stringContaining("publication blocked") },
    });
  });

  it("names the method as the problem when the path exists but the verb does not", async () => {
    const { call } = fixture();
    for (const [method, path] of [["PUT", "/api/clients"], ["GET", "/api/posts/post_1"]] as const) {
      expect(await call(method, path)).toEqual({ status: 405, body: { error: "method not allowed" } });
    }
    expect(await fixture({ app: "landing-page" }).call("GET", "/api/leads")).toEqual({ status: 405, body: { error: "method not allowed" } });
  });

  it("serves each app only its own rows (ADR-1766)", async () => {
    // Only the landing page is a public site; every other app opens on its screen.
    expect(await fixture().call("GET", "/")).toEqual({ status: 302, headers: { location: "/app" } });
    for (const path of ["/api/site", "/api/leads", "/sitemap.xml"]) expect((await fixture().call("POST", path)).status).toBe(404);
    // The pipeline is the CRM's; the landing page lists its leads and moves nobody.
    const site = fixture({ app: "landing-page" });
    expect((await site.call("POST", "/api/clients/cli_1/advance")).status).toBe(404);
    expect((await fixture({ app: "seo-geo" }).call("GET", "/api/clients")).status).toBe(404);
    // Every app has its own queue.
    expect(await fixture({ app: "ads" }).call("GET", "/api/posts")).toEqual({ status: 200, body: [] });
  });

  it("links the studio's CEO chat from Onboard, and refuses a client its team cannot be scoped to", async () => {
    if (ACTIVE_TEMPLATE.crew.length === 0) return;
    const { call, store } = fixture({ studioUrl: "https://studio.test" });
    const client = store.createLead(lead);
    const { body } = await call("POST", `/api/clients/${client.id}/onboard`);
    expect((body as { url: string }).url).toMatch(/^https:\/\/studio\.test\/orchestrator\?new=1&draft=Onboard\+Summit/);
    const scoped = ACTIVE_TEMPLATE.crew.some((seat) => JSON.stringify(seat.tools ?? {}).includes("{client.domain}"));
    const bare = store.createLead({ ...lead, name: "No Site", domain: "", contact: { ...lead.contact, email: "n@x.example" } });
    expect((await call("POST", `/api/clients/${bare.id}/onboard`)).status).toBe(scoped ? 422 : 200);
  });

  it("reads the persona's accounts for SEO & GEO and Ads, with a GET and nothing else", async () => {
    const upstream = vi.fn(async (url: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify(String(url).endsWith("/v1/identities/idn_1") ? { connections: ["c1", "c2"] } : String(url).endsWith("c1") ? { connector: "googleads", status: "active" } : { connector: "googlesearchconsole", status: "active" })));
    vi.stubGlobal("fetch", upstream);
    const config = { baseUrl: "https://api.example", apiKey: "secret", identityId: "idn_1", project: "agency" };
    expect((await fixture({ app: "ads", config }).call("GET", "/api/accounts")).body).toEqual({ data: [{ connector: "googleads", status: "active" }] });
    expect(((await fixture({ app: "seo-geo", config }).call("GET", "/api/accounts")).body as { data: unknown[] }).data).toHaveLength(2);
    expect(upstream.mock.calls.every(([, init]) => init?.method === "GET")).toBe(true);
    expect((await fixture({ app: "ads" }).call("GET", "/api/accounts")).status).toBe(503);
    expect((await fixture({ config }).call("GET", "/api/accounts")).status).toBe(404);
  });
});

describe("public discovery documents", () => {
  it("serves crawl directives, dynamic metadata, permanent articles, a complete sitemap, and an agency-readable llms file", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-04T12:00:00Z"));
    const shell = '<!doctype html><html><head><title>Agency services</title><meta name="description" content="generic" /></head><body><div id="root"></div><script type="module" src="/assets/site.js"></script></body></html>';
    const { call, store } = fixture({ app: "landing-page", publicShell: () => Promise.resolve(shell) });
    store.updateSite({ company: "Founder Frame", contact: { ...store.site().contact, email: "hello@founderframehq.com" } });
    const company = store.createLead({ name: "Founder Frame", domain: "", contact: { name: "", email: "", role: "" } });
    const live = store.createDraftPost({ clientId: company.id, title: "A safer <title>", summary: "Useful & specific", body: "## Answer\n\nA **clear** answer.\n\n- First", kind: "article", channel: "blog", scheduledFor: "2026-10-04" })!;
    store.updatePost(live.id, { status: "posted" });
    const future = store.createDraftPost({ clientId: company.id, title: "Future draft", summary: "Not public", body: "Wait", kind: "article", channel: "blog", scheduledFor: "2026-10-06" })!;
    store.updatePost(future.id, { status: "posted" });
    const headers = { host: "founderframehq.com", "x-forwarded-proto": "https" };

    const home = await call("GET", "/", "", headers);
    expect(home.text).toContain("<title>Founder Frame —");
    expect(home.text).toContain('<link rel="canonical" href="https://founderframehq.com/"');

    const robots = await call("GET", "/robots.txt", "", headers);
    expect(robots).toMatchObject({ status: 200, headers: { "content-type": "text/plain; charset=utf-8" } });
    expect(robots.text).toContain("Sitemap: https://founderframehq.com/sitemap.xml");
    expect(robots.text).toContain("Disallow: /app/");

    const sitemap = await call("GET", "/sitemap.xml", "", headers);
    expect(sitemap).toMatchObject({ status: 200, headers: { "content-type": "application/xml; charset=utf-8" } });
    expect(sitemap.text).toContain("<loc>https://founderframehq.com/</loc>");
    expect(sitemap.text).toContain(`<loc>https://founderframehq.com/blog/${live.id}</loc>`);
    expect(sitemap.text).not.toContain(future.id);

    const page = await call("GET", `/blog/${live.id}`, "", headers);
    expect(page).toMatchObject({ status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
    expect(page.text).toContain("A safer &lt;title&gt;");
    expect(page.text).toContain(`<link rel="canonical" href="https://founderframehq.com/blog/${live.id}"`);
    expect(page.text).toContain("<h2>Answer</h2>");
    expect(page.text).not.toContain('src="/assets/site.js"');
    expect((await call("GET", `/blog/${future.id}`, "", headers)).status).toBe(404);

    const feed = await call("GET", "/api/blog", "", headers);
    expect(feed.body).toMatchObject([{ id: live.id, path: `/blog/${live.id}` }]);
    expect(JSON.stringify(feed.body)).not.toContain(future.id);

    const llms = await call("GET", "/llms.txt", "", headers);
    expect(llms).toMatchObject({ status: 200, headers: { "content-type": "text/plain; charset=utf-8" } });
    expect(llms.text).toContain("# Founder Frame");
    expect(llms.text).toContain("mailto:hello@founderframehq.com");
    expect(llms.text).toContain(`https://founderframehq.com/blog/${live.id}`);
    vi.useRealTimers();
  });
});

describe("/mcp", () => {
  it("is the same document as /api/clients — an agent's write is what the UI reads", async () => {
    const { call } = fixture();
    const created = await call("POST", "/mcp", rpc("tools/call", {
      name: "create_lead",
      arguments: { name: "Bluefin", domain: "bluefin.example", contact_name: "Sam", contact_email: "sam@bluefin.example", contact_role: "VP" },
    }), { authorization: "Bearer platform-token" });
    expect(created.status).toBe(200);
    expect((await call("GET", "/api/clients")).body).toHaveLength(1);
  });

  it("refuses a missing or wrong bearer, and anything but POST", async () => {
    const { call } = fixture();
    expect(await call("POST", "/mcp", rpc("tools/list"))).toEqual({
      status: 401, body: { error: "missing or invalid bearer token" },
    });
    expect(await call("POST", "/mcp", rpc("tools/list"), { authorization: "Bearer nope" })).toMatchObject({ status: 401 });
    expect(await call("GET", "/mcp")).toEqual({ status: 405, body: { error: "POST only" } });
  });

  it("lets a bare GET fail with the store while the database is unreachable", async () => {
    const down = new Error("connect ECONNREFUSED");
    const { call } = fixture({ store: () => Promise.reject(down) });
    await expect(call("GET", "/mcp")).rejects.toBe(down);
  });

  it("answers a notification with a bodiless 202, and takes no bearer but the platform's", async () => {
    const { call } = fixture();
    expect(await call("POST", "/mcp", rpc("notifications/initialized"), { authorization: "Bearer platform-token" })).toEqual({ status: 202 });
    expect((await fixture({ mcpToken: undefined }).call("POST", "/mcp", rpc("tools/list"), { authorization: "Bearer " })).status).toBe(401);
  });

  it("lists each app's own tools, so an agent reaches them as <app>.<tool>", async () => {
    const names = async (app: ApiContext["app"]) =>
      ((await fixture({ app }).call("POST", "/mcp", rpc("tools/list"), { authorization: "Bearer platform-token" })).body as { result: { tools: { name: string }[] } })
        .result.tools.map((t) => t.name);
    expect(await names("crm")).toContain("get_client_crew");
    expect(await names("crm")).not.toContain("get_site");
    expect(await names("landing-page")).toEqual(expect.arrayContaining(["get_site", "update_site", "list_new_leads", "mark_lead_filed"]));
    expect(await names("ads")).toEqual(["list_posts", "create_draft_post", "approve_post", "schedule_post", "get_calendar"]);
  });
});

/**
 * The whole reason this gate exists: the deployed dashboard was a public URL that answered every
 * `/api/*` route to anonymous curl — the CRM with its contacts' email addresses, the org's agent
 * roster with its system prompts, the content queue as a writable surface, and the session relay.
 */
describe("the /api/* gate", () => {
  const deployed = { local: false, dashboardToken: "dash" };
  const bearer = { authorization: "Bearer dash" };

  it("refuses an anonymous read of the CRM, and a wrong token, and admits the right one", async () => {
    const { call, store } = fixture(deployed);
    store.createLead(lead);
    const unauthenticated = await call("GET", "/api/clients");
    expect(unauthenticated).toEqual({ status: 401, body: { error: "missing or invalid access token" } });
    // Not one row of it, and not the contact's email address, leaves the server.
    expect(JSON.stringify(unauthenticated.body)).not.toContain("jordan@summitoutdoor.example");

    expect(await call("GET", "/api/clients", "", { authorization: "Bearer wrong" })).toMatchObject({ status: 401 });
    // A bare token without the scheme is not a credential either.
    expect(await call("GET", "/api/clients", "", { authorization: "dash" })).toMatchObject({ status: 401 });

    const allowed = await call("GET", "/api/clients", "", bearer);
    expect(allowed.status).toBe(200);
    expect(allowed.body).toHaveLength(1);
  });

  /**
   * The public site's routes stand open on purpose: a visitor holds no bearer, the copy is what
   * the page shows anyway, and the contact form has to land as a lead or the site sells nothing.
   * Neither reads a row back — the lead is answered as created, and the CRM stays behind the gate.
   */
  it("leaves the site's copy and its contact form open to a visitor, and nothing else", async () => {
    const { call, store } = fixture({ ...deployed, app: "landing-page" });
    const copy = await call("GET", "/api/site");
    expect(copy.status).toBe(200);
    expect(copy.headers).toEqual({ "cache-control": "public, max-age=60" });
    expect((copy.body as { hero: { title: string } }).hero.title).toBeTruthy();
    store.updateSite({ company: "Acme Search", contact: { ...store.site().contact, email: "hello@acme.com" } });
    expect((await call("GET", "/api/site")).body).toMatchObject({ company: "Acme Search", contact: { email: "hello@acme.com" } });
    store.updateSite({ pricing: { ...store.site().pricing, subtitle: "$2,500 per month" } });
    expect((await call("GET", "/api/site")).body).toMatchObject({ company: "Your agency", contact: { email: "" } });
    expect(await call("PATCH", "/api/site", {})).toMatchObject({ status: 405 });
    expect(await call("GET", "/api/blog")).toMatchObject({ status: 200, body: [] });

    expect((await call("POST", "/api/leads", lead)).status).toBe(201);
    expect(await call("GET", "/api/leads")).toMatchObject({ status: 405 });
    // The row it made is still behind the gate.
    expect(await call("GET", "/api/clients")).toMatchObject({ status: 401 });
  });

  it("gates the writes too — the queue, the pipeline and a billable session alike", async () => {
    const { call, store, writes } = fixture(deployed);
    const client = store.createLead(lead);
    const before = writes();
    for (const [method, path] of [
      ["POST", `/api/clients/${client.id}/advance`],
      ["POST", `/api/clients/${client.id}/onboard`], ["PATCH", "/api/posts/post_1"],
      ["POST", "/api/posts/post_1/post-now"], ["POST", "/api/chat"], ["GET", "/api/chat/ses_1/stream"],
      ["GET", "/api/agents"], ["GET", "/api/social/accounts"],
    ] as const) {
      expect(await call(method, path, lead)).toMatchObject({ status: 401 });
    }
    // Nothing was written on the way to being refused.
    expect(writes()).toBe(before);
  });

  it("answers 503 on a deployment with no token configured — a missing credential is never open", async () => {
    const { call } = fixture({ local: false, dashboardToken: undefined });
    expect(await call("GET", "/api/clients")).toEqual({
      status: 503, body: { error: "not configured — set DASHBOARD_TOKEN" },
    });
    // An empty string is unset, not a token every caller can guess.
    expect(await call("GET", "/api/clients", "", { authorization: "Bearer " })).toMatchObject({ status: 503 });
    expect((await fixture({ local: false, dashboardToken: "" }).call("GET", "/api/posts")).status).toBe(503);
  });

  it("hides which routes exist, and leaves /mcp on its own separate bearer", async () => {
    const { call } = fixture(deployed);
    // 401 before the route table: an anonymous caller cannot even map the surface.
    expect(await call("GET", "/api/nothing")).toMatchObject({ status: 401 });
    // The agents' credential is not the operator's, and neither opens the other's door.
    expect(await call("GET", "/api/clients", "", { authorization: "Bearer platform-token" })).toMatchObject({ status: 401 });
    expect(await call("POST", "/mcp", rpc("tools/list"), { authorization: "Bearer platform-token" })).toMatchObject({ status: 200 });
    expect(await call("POST", "/mcp", rpc("tools/list"), bearer)).toMatchObject({ status: 401 });
  });

  it("lets a genuinely local pnpm serve through with nothing set, and never a deployment", async () => {
    expect((await fixture({ local: true, dashboardToken: undefined }).call("GET", "/api/clients")).status).toBe(200);
    // Local with a token set still enforces it — configuring one is asking for it to be checked.
    expect(await fixture({ local: true, dashboardToken: "dash" }).call("GET", "/api/clients")).toMatchObject({ status: 401 });
  });

  /**
   * THE ONE DOOR THROUGH THE GATE (`canonical-spec §29.7`).
   *
   * `DASHBOARD_TOKEN` is generated by the platform so that nobody has to invent one, and no route
   * anywhere returns an app secret — so there is no value for an operator to be asked for and none
   * for them to paste. The studio posts a two-minute ticket to `/api/enter` instead, and that route
   * trades it for the cookie the browser then carries on its own.
   */
  describe("the entry ticket is the way in, and the ticket is not the token", () => {
    const ticket = (expiresAt: number, token = "dash") =>
      `${expiresAt}.${createHmac("sha256", token).update(`vetta.app-entry.v1:${expiresAt}`).digest("base64url")}`;

    const enter = (body: string) =>
      fixture(deployed).call("POST", "/api/enter", body, { "content-type": "application/x-www-form-urlencoded" });

    it("trades a live ticket for an HttpOnly cookie and a redirect, and answers no body at all", async () => {
      const reply = await enter(new URLSearchParams({ ticket: ticket(Date.now() + 60_000) }).toString());
      expect(reply.status).toBe(303);
      expect(reply.body).toBeUndefined();
      // To the operator UI, which lives under `/app`; `/` is the public site and needs no cookie.
      expect(reply.headers?.["location"]).toBe("/app");
      // Deployed, the dashboard is also framed by the studio: a `Lax` cookie never reaches a framed
      // cross-site document, so it is `None` and partitioned per top-level site (CHIPS). Two headers,
      // not one joined: the first expires the pre-partitioning cookie a returning browser still holds,
      // and the session cookie comes SECOND — a browser without CHIPS ignores `Partitioned`, sees one
      // cookie named twice, and keeps the last header; the other order signed it straight out again.
      expect(reply.headers?.["set-cookie"]).toEqual([
        "dashboard_session=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax; Secure",
        `dashboard_session=dash; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=${30 * 24 * 60 * 60}`,
      ]);
    });

    it("keeps a laptop's cookie Lax and not Secure: Partitioned needs Secure, and there is no frame", async () => {
      const reply = await fixture({ local: true, dashboardToken: "dash" })
        .call("POST", "/api/enter", new URLSearchParams({ ticket: ticket(Date.now() + 60_000) }).toString(), { "content-type": "application/x-www-form-urlencoded" });
      // One header, a string: a laptop never held the deployed cookie, so there is nothing to expire.
      expect(reply.headers?.["set-cookie"]).toBe(`dashboard_session=dash; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`);
    });

    /**
     * A browser that signed in before the cookie was partitioned keeps the old `Lax` cookie beside
     * the new one — same name, same path, so the jar sends both — and if the token has since been
     * rotated, the first value the server looked at was the stale one. Every value is tried, and a
     * request whose values are all stale is told to drop the old cookie.
     */
    describe("a legacy cookie beside the live one", () => {
      const both = "dashboard_session=stale-rotated-token; dashboard_session=dash";

      it("is in when ANY dashboard_session value is the token, whichever the browser sent first", async () => {
        const { call, store } = fixture(deployed);
        expect((await call("GET", "/api/clients", "", { cookie: both })).status).toBe(200);
        expect((await call("GET", "/api/clients", "", { cookie: "dashboard_session=dash; dashboard_session=stale" })).status).toBe(200);
        expect((await call("GET", "/api/session", "", { cookie: both })).body).toMatchObject({ authenticated: true });
        // The guard still applies to what the live value authenticates.
        const client = store.createLead(lead);
        expect((await call("POST", `/api/clients/${client.id}/advance`, "", { cookie: both, "sec-fetch-site": "same-origin" })).status).toBe(200);
        expect((await call("POST", `/api/clients/${client.id}/advance`, "", { cookie: both, "sec-fetch-site": "cross-site" })).status).toBe(403);
      });

      it("answers 401 and expires the legacy cookie when no value is the token", async () => {
        const reply = await fixture(deployed).call("GET", "/api/clients", "", { cookie: "dashboard_session=stale; dashboard_session=older" });
        expect(reply).toEqual({
          status: 401,
          body: { error: "missing or invalid access token" },
          headers: { "set-cookie": "dashboard_session=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax; Secure" },
        });
        // A single stale cookie earns the same header; a laptop's spells it without `Secure`.
        expect((await fixture(deployed).call("GET", "/api/clients", "", { cookie: "dashboard_session=nope" })).headers)
          .toEqual({ "set-cookie": "dashboard_session=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax; Secure" });
        expect((await fixture({ local: true, dashboardToken: "dash" }).call("GET", "/api/clients", "", { cookie: "dashboard_session=nope" })).headers)
          .toEqual({ "set-cookie": "dashboard_session=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax" });
        // No cookie at all is the plain 401: there is nothing to expire, and a bearer caller gets no jar.
        expect((await fixture(deployed).call("GET", "/api/clients")).headers).toBeUndefined();
        // `/api/session` reports the verdict and, as ever, sets nothing.
        const session = await fixture(deployed).call("GET", "/api/session", "", { cookie: "dashboard_session=stale" });
        expect(session.body).toMatchObject({ authenticated: false });
        expect(session.headers?.["set-cookie"]).toBeUndefined();
      });
    });

    it("takes the ticket from a JSON body too, because the host parses a form for us", async () => {
      expect((await enter(JSON.stringify({ ticket: ticket(Date.now() + 60_000) }))).status).toBe(303);
    });

    const badTickets = () => [
      ticket(Date.now() - 1),
      ticket(Date.now() + 60_000, "some-other-app-token"),
      `${Date.now() + 60_000}.not-a-mac`,
      "dash",
      "",
    ];

    it("refuses an expired ticket, a forged one and a bare token, and sets no cookie", async () => {
      for (const bad of badTickets()) {
        // A JSON caller gets the 403 and the sentence, as ever.
        const reply = await fixture(deployed).call("POST", "/api/enter", { ticket: bad });
        expect(reply.status, bad).toBe(403);
        expect(reply.headers?.["set-cookie"]).toBeUndefined();
      }
    });

    it("sends a refused form back to the gate screen with `entry=denied`, and still no cookie", async () => {
      // The studio's handoff and the gate screen's own form are top-level navigations: a 403 JSON
      // body would be the whole page, so a refused form lands on the sign-in screen with a sentence.
      for (const bad of badTickets()) {
        const reply = await enter(new URLSearchParams({ ticket: bad }).toString());
        expect(reply, bad).toEqual({ status: 303, headers: { location: "/app?entry=denied" } });
      }
    });

    it("opens every gated route for the cookie it set, with no header anywhere", async () => {
      const { call } = fixture(deployed);
      expect((await call("GET", "/api/clients", "", { cookie: "other=1; dashboard_session=dash" })).status).toBe(200);
      // A cookie that is not the token is still refused: the cookie is checked, not merely present.
      expect((await call("GET", "/api/clients", "", { cookie: "dashboard_session=nope" })).status).toBe(401);
    });

    /**
     * A `SameSite=None` cookie rides on cross-site requests too, which is what `Lax` used to
     * forbid. So a WRITE the cookie authenticates must come from this dashboard's own pages — framed
     * by the studio or not, the request is still same-origin to its own API.
     */
    describe("a cookie-authenticated write must be the dashboard's own", () => {
      const cookie = { cookie: "dashboard_session=dash" };
      /** A gated write: advancing a lead. Answers 200 with the advanced row, or is refused. */
      const advance = async (headers: Record<string, string>) => {
        const { call, store } = fixture(deployed);
        const client = store.createLead(lead);
        const reply = await call("POST", `/api/clients/${client.id}/advance`, "", headers);
        return { reply, stage: store.read().clients[0]?.stage };
      };

      it("passes the framed dashboard's own fetch, and the address bar", async () => {
        expect((await advance({ ...cookie, "sec-fetch-site": "same-origin" })).reply.status).toBe(200);
        expect((await advance({ ...cookie, "sec-fetch-site": "none" })).reply.status).toBe(200);
        // A browser too old for `sec-fetch-site` must at least name this host as its origin.
        expect((await advance({ ...cookie, host: "agency.example", origin: "https://agency.example" })).reply.status).toBe(200);
      });

      it("refuses a cross-site POST that arrived with the cookie, with a sentence and no write", async () => {
        for (const headers of [
          { ...cookie, "sec-fetch-site": "cross-site" },
          { ...cookie, "sec-fetch-site": "same-site" },
          { ...cookie, host: "agency.example", origin: "https://evil.example" },
          { ...cookie, host: "agency.example", origin: "not a url" },
          { ...cookie, host: "agency.example" },
          cookie,
        ]) {
          const { reply, stage } = await advance(headers);
          expect(reply, JSON.stringify(headers)).toEqual({ status: 403, body: { error: "cross-site request refused" } });
          expect(stage, JSON.stringify(headers)).toBe("lead");
        }
        const { call } = fixture(deployed);
        for (const method of ["PUT", "PATCH", "DELETE"]) {
          expect((await call(method, "/api/posts/post_1", {}, { ...cookie, "sec-fetch-site": "cross-site" })).status, method).toBe(403);
        }
      });

      it("treats every method but GET and HEAD as a write — a method outside any list is not a way round the guard", async () => {
        const { call } = fixture(deployed);
        for (const method of ["OPTIONS", "PROPFIND", "QUERY"]) {
          const crossSite = { ...cookie, host: "agency.example", origin: "https://evil.example" };
          expect(await call(method, "/api/agents", "", { ...cookie, "sec-fetch-site": "cross-site" }), method)
            .toEqual({ status: 403, body: { error: "cross-site request refused" } });
          expect((await call(method, "/api/agents", "", crossSite)).status, method).toBe(403);
          // Same-origin, the method reaches the route table and is judged there, not here.
          expect((await call(method, "/api/agents", "", { ...cookie, "sec-fetch-site": "same-origin" })).status, method).not.toBe(403);
        }
        expect((await call("HEAD", "/api/clients", "", { ...cookie, "sec-fetch-site": "cross-site" })).status).not.toBe(403);
      });

      it("asks nothing of a bearer, a read, or /api/enter — none of them is a cookie another site could spend", async () => {
        expect((await advance({ ...bearer, "sec-fetch-site": "cross-site" })).reply.status).toBe(200);
        const { call } = fixture(deployed);
        expect((await call("GET", "/api/clients", "", { ...cookie, "sec-fetch-site": "cross-site" })).status).toBe(200);
        expect((await call("GET", "/api/clients", "", cookie)).status).toBe(200);
        const handoff = await call("POST", "/api/enter", new URLSearchParams({ ticket: ticket(Date.now() + 60_000) }).toString(), {
          ...cookie, "content-type": "application/x-www-form-urlencoded", "sec-fetch-site": "cross-site",
        });
        expect(handoff.status).toBe(303);
        // The public site's contact form is not gated, so it is not this guard's either.
        const site = fixture({ ...deployed, app: "landing-page" });
        expect((await site.call("POST", "/api/leads", lead, { ...cookie, "sec-fetch-site": "cross-site" })).status).toBe(201);
        // The wrong cookie is still the wrong cookie, before any question of origin.
        expect((await advance({ cookie: "dashboard_session=nope", "sec-fetch-site": "same-origin" })).reply.status).toBe(401);
      });
    });

    it("is the only /api route that runs before the gate, so it needs no credential to reach", async () => {
      expect((await enter("ticket=")).status).not.toBe(401);
    });
  });

  /**
   * THE SECOND DOOR: THE PASSWORD.
   *
   * The ticket needs a studio that can hand the browser back signed in; a colleague's browser, or
   * an operator signed out of the studio too, has none. `DASHBOARD_PASSWORD` is the one credential
   * the platform generates to be handed to a person (read off the studio's Access panel, audited),
   * and the gate screen posts it here as a plain form. It earns the identical cookie.
   */
  describe("the dashboard password is the other way in", () => {
    const withPassword = { ...deployed, dashboardPassword: "kq7m-x2rt-8bvn-pz4h" };
    const form = (fields: Record<string, string>) =>
      [new URLSearchParams(fields).toString(), { "content-type": "application/x-www-form-urlencoded" }] as const;

    it("trades the right password for the same cookie and the same redirect a ticket earns", async () => {
      const reply = await fixture(withPassword).call("POST", "/api/enter", ...form({ password: "kq7m-x2rt-8bvn-pz4h" }));
      expect(reply.status).toBe(303);
      expect(reply.body).toBeUndefined();
      expect(reply.headers?.["location"]).toBe("/app");
      // Expiring header first, session cookie second: the same order, for the same reason, as a ticket's.
      const [expiring, cookie] = reply.headers?.["set-cookie"] ?? [];
      // The cookie is the token, as for a ticket — never the password.
      expect(cookie).toContain("dashboard_session=dash");
      expect(cookie).not.toContain("kq7m");
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("Secure; SameSite=None; Partitioned");
      expect(expiring).toBe("dashboard_session=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax; Secure");
      // A JSON body works too, for the same reason the ticket's does.
      expect((await fixture(withPassword).call("POST", "/api/enter", { password: "kq7m-x2rt-8bvn-pz4h" })).status).toBe(303);
    });

    it("refuses a wrong password: back to the gate for a form, 403 for JSON, never a cookie", async () => {
      for (const wrong of ["kq7m-x2rt-8bvn-pz4H", "kq7m", "dash"]) {
        expect(await fixture(withPassword).call("POST", "/api/enter", ...form({ password: wrong })), wrong)
          .toEqual({ status: 303, headers: { location: "/app?entry=denied" } });
        const asJson = await fixture(withPassword).call("POST", "/api/enter", { password: wrong });
        expect(asJson, wrong).toEqual({ status: 403, body: { error: "that password did not check out" } });
      }
    });

    it("refuses every password when DASHBOARD_PASSWORD is unset — an absent door is not an open one", async () => {
      expect(await fixture(deployed).call("POST", "/api/enter", ...form({ password: "kq7m-x2rt-8bvn-pz4h" })))
        .toEqual({ status: 303, headers: { location: "/app?entry=denied" } });
      expect((await fixture(deployed).call("POST", "/api/enter", { password: "anything" })).status).toBe(403);
      // An empty password field is not a password: the body is read as a ticket, and there is none.
      expect((await fixture({ ...deployed, dashboardPassword: "" }).call("POST", "/api/enter", { password: "" })).status).toBe(403);
    });

    it("still needs the token, because the token is what the cookie carries", async () => {
      const reply = await fixture({ ...withPassword, dashboardToken: undefined }).call("POST", "/api/enter", { password: "kq7m-x2rt-8bvn-pz4h" });
      expect(reply).toMatchObject({ status: 503 });
    });
  });

  /**
   * WHAT THE GATE SCREEN ASKS FIRST. Ungated, cookie-free, and the same verdict the gate gives:
   * the screen renders nothing of the dashboard until this says `authenticated`.
   */
  describe("GET /api/session", () => {
    const studio = { ...deployed, studioUrl: "https://app.usenaive.ai/", appId: "app_123" };

    it("tells a signed-out browser which doors exist, and sets nothing", async () => {
      const reply = await fixture({ ...studio, dashboardPassword: "kq7m-x2rt-8bvn-pz4h" }).call("GET", "/api/session");
      expect(reply.status).toBe(200);
      expect(reply.body).toEqual({
        authenticated: false,
        studio_url: "https://app.usenaive.ai/apps/app_123/open",
        password_enabled: true,
        app: "crm",
      });
      expect(reply.headers?.["set-cookie"]).toBeUndefined();
      // Nothing secret rides along: not the token, not the password.
      expect(JSON.stringify(reply.body)).not.toMatch(/dash|kq7m/);
    });

    it("says authenticated for the cookie /api/enter set, and for the bearer — the gate's own check", async () => {
      const { call } = fixture(studio);
      expect((await call("GET", "/api/session", "", { cookie: "dashboard_session=dash" })).body).toMatchObject({ authenticated: true });
      expect((await call("GET", "/api/session", "", { authorization: "Bearer dash" })).body).toMatchObject({ authenticated: true });
      expect((await call("GET", "/api/session", "", { cookie: "dashboard_session=nope" })).body).toMatchObject({ authenticated: false });
      // A deployment with no token is closed, and says so the same way the gate does.
      expect((await fixture({ ...studio, dashboardToken: undefined }).call("GET", "/api/session")).body).toMatchObject({ authenticated: false });
      // A genuinely local `pnpm serve` with nothing set is in, because its gate stands open.
      expect((await fixture().call("GET", "/api/session")).body).toEqual({ authenticated: true, studio_url: null, password_enabled: false, app: "crm" });
    });

    it("has no studio link unless both the studio and the app id are known, and no password door unless one is set", async () => {
      expect((await fixture(deployed).call("GET", "/api/session")).body).toEqual({ authenticated: false, studio_url: null, password_enabled: false, app: "crm" });
      expect((await fixture({ ...deployed, studioUrl: "https://app.usenaive.ai" }).call("GET", "/api/session")).body).toMatchObject({ studio_url: null });
      expect((await fixture({ ...deployed, appId: "app_123" }).call("GET", "/api/session")).body).toMatchObject({ studio_url: null });
      expect((await fixture({ ...deployed, dashboardPassword: "" }).call("GET", "/api/session")).body).toMatchObject({ password_enabled: false });
    });

    it("is GET only, runs before the gate, and leaves every other route gated", async () => {
      const { call } = fixture(deployed);
      expect(await call("POST", "/api/session", {})).toMatchObject({ status: 405 });
      expect((await call("GET", "/api/session")).status).toBe(200);
      for (const path of ["/api/clients", "/api/posts", "/api/agents", "/api/sessions", "/api/nothing"]) {
        expect(await call("GET", path), path).toMatchObject({ status: 401 });
      }
    });
  });

  it("calls only a loopback peer local — `pnpm serve` binds every interface", () => {
    for (const address of ["127.0.0.1", "::1", "::ffff:127.0.0.1"]) expect(isLoopback(address)).toBe(true);
    // A LAN peer and anything through a tunnel are not the developer this bypass is for, and an
    // unknown peer is not one either.
    for (const address of ["192.168.1.14", "10.0.0.7", "203.0.113.9", "::ffff:10.0.0.7", "", undefined]) {
      expect(isLoopback(address)).toBe(false);
    }
  });
});


describe("review fixes (ADR-1766)", () => {
  it("frees the landing page's inbox as leads are filed, and takes a returning visitor's new message", async () => {
    const { call, store } = fixture({ app: "landing-page" });
    const first = (await call("POST", "/api/leads", lead)).body as { id: string };
    store.markLeadFiled(first.id);
    const again = await call("POST", "/api/leads", { ...lead, note: "Writing again." });
    expect(again.status).toBe(201);
    expect((again.body as { id: string }).id).not.toBe(first.id);
    for (let i = store.read().clients.length; i < OPEN_LEADS_CAP + 5; i += 1) {
      const row = store.createLead({ ...lead, domain: `d${i}.example`, contact: { ...lead.contact, email: `p${i}@d${i}.example` } });
      store.markLeadFiled(row.id);
    }
    expect((await call("POST", "/api/leads", { ...lead, domain: "late.example", contact: { ...lead.contact, email: "late@late.example" } })).status).not.toBe(429);
  });

  it("serves the public site's shell only from the landing page; every other app sends a path to its screen", async () => {
    const shell = "<!doctype html><title>site</title>";
    const site = await fixture({ app: "landing-page", publicShell: () => Promise.resolve(shell) }).call("GET", "/pricing");
    expect(site).toMatchObject({ status: 200, text: shell });
    for (const app of ["crm", "seo-geo", "ads"] as const) {
      expect(await fixture({ app, publicShell: () => Promise.resolve(shell) }).call("GET", "/pricing")).toEqual({ status: 302, headers: { location: "/app" } });
    }
  });
});

describe("the calendar's routes (ADR-1766)", () => {
  it("lists its events and marks one done; no other app serves them", async () => {
    const { call, store } = fixture({ app: "calendar" });
    const e = store.createEvent({ kind: "meeting", title: "Kickoff", clientId: "cli_1", start: "2026-11-04T15:00:00Z" });
    expect((await call("GET", "/api/events")).body).toEqual([e]);
    expect((await call("PATCH", `/api/events/${e.id}`, { status: "done" })).body).toMatchObject({ status: "done" });
    expect((await call("PATCH", `/api/events/${e.id}`, { status: "maybe" })).status).toBe(400);
    expect((await fixture().call("GET", "/api/events")).status).toBe(404);
  });
});
