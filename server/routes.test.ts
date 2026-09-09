/**
 * The route table, tested without a socket or a database — which is the reason it moved out of
 * `server/index.ts`. Both callers (`pnpm serve` and the deployed function) run exactly this.
 */
import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { hashToken } from "./mcp.ts";
import { handleRequest, isLoopback, OPEN_LEADS_CAP, type ApiContext, type ApiRequest } from "./routes.ts";
import { LEAD_WINDOW_MS, LEADS_PER_WINDOW } from "./store.ts";
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
    store: () => Promise.resolve(store),
    config: null,
    mcpToken: "platform-token",
    // Unset by default, with `local: true`: `pnpm serve` for development is the one place the
    // `/api/*` gate is allowed to stand open, and every store test below is that case.
    dashboardToken: undefined,
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
    const { call, writes } = fixture();
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

  it("bounds what the anonymous form may write: one open row per contact, a cap on open leads, a size on fields", async () => {
    const { call, writes, store } = fixture();
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
      const { call, store } = fixture();
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
    // No key on this server, so no crew is provisioned and the report says so rather than lying.
    expect(onboarded.body).toMatchObject({ agents: null, client: { stage: "active" } });

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
      clientId: client.id, title: "t", summary: "s", kind: "article", channel: "blog", scheduledFor: "2026-01-05",
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

  it("names the method as the problem when the path exists but the verb does not", async () => {
    const { call } = fixture();
    for (const [method, path] of [["POST", "/api/clients"], ["GET", "/api/leads"], ["GET", "/api/posts/post_1"]] as const) {
      expect(await call(method, path)).toEqual({ status: 405, body: { error: "method not allowed" } });
    }
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

  it("accepts a token minted from Settings and answers a notification with a bodiless 202", async () => {
    const { call, store } = fixture();
    store.addMcpToken("desktop", hashToken("mcp_local"));
    const listed = await call("POST", "/mcp", rpc("tools/list"), { authorization: "Bearer mcp_local" });
    expect(listed.status).toBe(200);
    expect(await call("POST", "/mcp", rpc("notifications/initialized"), { authorization: "Bearer mcp_local" }))
      .toEqual({ status: 202 });
  });
});

describe("/api/mcp/tokens is local-only", () => {
  it("mints, lists and revokes on a local server", async () => {
    const { call } = fixture();
    expect(await call("GET", "/api/mcp/tokens")).toEqual({ status: 200, body: [] });
    const minted = await call("POST", "/api/mcp/tokens", { name: "desktop" });
    expect(minted.status).toBe(201);
    const { id, token } = minted.body as { id: string; token: string };
    expect(token).toMatch(/^mcp_/);
    expect((await call("GET", "/api/mcp/tokens")).body).toHaveLength(1);
    // The hash is kept, never the token: the list cannot hand it back.
    expect(JSON.stringify((await call("GET", "/api/mcp/tokens")).body)).not.toContain(token);
    expect(await call("DELETE", `/api/mcp/tokens/${id}`)).toEqual({ status: 200, body: { ok: true } });
    expect(await call("DELETE", `/api/mcp/tokens/${id}`)).toEqual({ status: 404, body: { error: "no such token" } });
    expect(await call("POST", "/api/mcp/tokens", {})).toEqual({ status: 400, body: { error: "name is required" } });
  });

  it("does not exist on the deployment, where an unauthenticated mint would hand out the agency", async () => {
    const { call } = fixture({ local: false, dashboardToken: "dash" });
    for (const [method, path] of [["GET", "/api/mcp/tokens"], ["POST", "/api/mcp/tokens"], ["DELETE", "/api/mcp/tokens/tok_1"]] as const) {
      expect(await call(method, path, { name: "x" }, { authorization: "Bearer dash" }))
        .toEqual({ status: 404, body: { error: "no such route" } });
    }
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
   * The public site's two routes stand open on purpose: a visitor holds no bearer, the copy is what
   * the page shows anyway, and the contact form has to land as a lead or the site sells nothing.
   * Neither reads a row back — the lead is answered as created, and the CRM stays behind the gate.
   */
  it("leaves the site's copy and its contact form open to a visitor, and nothing else", async () => {
    const { call } = fixture(deployed);
    const copy = await call("GET", "/api/site");
    expect(copy.status).toBe(200);
    expect(copy.headers).toEqual({ "cache-control": "public, max-age=60" });
    expect((copy.body as { hero: { title: string } }).hero.title).toBeTruthy();
    expect(await call("PATCH", "/api/site", {})).toMatchObject({ status: 405 });

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
      const cookie = reply.headers?.["set-cookie"] ?? "";
      expect(cookie).toContain("dashboard_session=dash");
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("SameSite=Lax");
      expect(cookie).toContain("Secure");
    });

    it("takes the ticket from a JSON body too, because the host parses a form for us", async () => {
      expect((await enter(JSON.stringify({ ticket: ticket(Date.now() + 60_000) }))).status).toBe(303);
    });

    it("refuses an expired ticket, a forged one and a bare token, and sets no cookie", async () => {
      for (const bad of [
        ticket(Date.now() - 1),
        ticket(Date.now() + 60_000, "some-other-app-token"),
        `${Date.now() + 60_000}.not-a-mac`,
        "dash",
        "",
      ]) {
        const reply = await enter(new URLSearchParams({ ticket: bad }).toString());
        expect(reply.status, bad).toBe(403);
        expect(reply.headers?.["set-cookie"]).toBeUndefined();
      }
    });

    it("opens every gated route for the cookie it set, with no header anywhere", async () => {
      const { call } = fixture(deployed);
      expect((await call("GET", "/api/clients", "", { cookie: "other=1; dashboard_session=dash" })).status).toBe(200);
      // A cookie that is not the token is still refused: the cookie is checked, not merely present.
      expect((await call("GET", "/api/clients", "", { cookie: "dashboard_session=nope" })).status).toBe(401);
    });

    it("is the only /api route that runs before the gate, so it needs no credential to reach", async () => {
      expect((await enter("ticket=")).status).not.toBe(401);
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

describe("the platform routes", () => {
  const config = { baseUrl: "https://api.test", apiKey: "sk_test", identityId: "idn_1", project: "agency" };

  it("says the key is missing rather than swallowing it, and only for routes that need one", async () => {
    const { call } = fixture();
    expect(await call("GET", "/api/agents")).toEqual({
      status: 503, body: { error: "not configured — set NAIVE_API_KEY" },
    });
    expect(await call("GET", "/api/social/accounts")).toMatchObject({ status: 503 });
    // The store routes are the app's own database and keep working without any key at all.
    expect((await call("GET", "/api/clients")).status).toBe(200);
    expect(await call("GET", "/api/nothing")).toEqual({ status: 404, body: { error: "no such route" } });
  });

  it("proxies the agent roster with the key on the upstream request only", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: "agt_1", name: "sales" }], has_more: false, next_cursor: null }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchImpl);
    const { call } = fixture({ config });
    const reply = await call("GET", "/api/agents");
    expect(reply).toEqual({ status: 200, body: { data: [{ id: "agt_1", name: "sales" }], has_more: false, next_cursor: null } });
    expect(fetchImpl).toHaveBeenCalledWith("https://api.test/v1/agents?limit=100", expect.objectContaining({ method: "GET" }));
    expect(JSON.stringify(reply.body)).not.toContain("sk_test");
  });

  /**
   * The platform pages at 20 and a real agency org has 600+ agents, so page one is not the roster:
   * `GET /api/agents` returned twenty rows and neither `sales` nor `client-manager` — the org's own
   * two agents — appeared in their own dashboard.
   */
  it("follows the cursor to the end of the roster, on the screen and for the agency chat", async () => {
    const pageOf = (rows: { id: string; name: string }[], next: string | null) =>
      new Response(JSON.stringify({ data: rows, has_more: next !== null, next_cursor: next }), { status: 200 });
    const fetchImpl = vi.fn(async (url: string, _init?: RequestInit) =>
      url.includes("after=agt_20")
        ? pageOf([{ id: "agt_21", name: "sales" }, { id: "agt_22", name: "client-manager" }], null)
        : pageOf([{ id: "agt_20", name: "seo-writer--acme" }], "agt_20"));
    vi.stubGlobal("fetch", fetchImpl);
    const { call } = fixture({ config });

    const roster = (await call("GET", "/api/agents")).body as { data: { name: string }[] };
    expect(roster.data.map((a) => a.name)).toEqual(["seo-writer--acme", "sales", "client-manager"]);
    // 100 is the spec's ceiling, so the roster is read in as few round trips as the platform allows.
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("https://api.test/v1/agents?limit=100");
    expect(fetchImpl.mock.calls[1]?.[0]).toBe("https://api.test/v1/agents?limit=100&after=agt_20");

    // And the chat resolves `client-manager` off the second page instead of saying it does not exist.
    const created = await call("POST", "/api/chat", { message: "hi" });
    expect(created.status).not.toBe(503);
    const session = fetchImpl.mock.calls.find(([url]) => url.endsWith("/v1/sessions"));
    expect(JSON.parse(String(session?.[1]?.body))).toMatchObject({ agent_id: "agt_22" });
  });

  it("hands the session relay back as a stream instead of buffering it", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response("event: message.delta\ndata: {}\n\n", { status: 200 }),
    ));
    const { call } = fixture({ config });
    const reply = await call("GET", "/api/chat/ses_abc/stream");
    expect(reply.stream).toBeInstanceOf(Response);
    expect(reply.body).toBeUndefined();
  });

  /**
   * A tool held at `ask` parks the session with the blocked call in `pending_actions`, and until
   * this route existed the dashboard could not see one: the moment the whole approval gate exists
   * for reached the operator as silence, resolvable only from a terminal.
   */
  it("reads the sessions a parked approval lives in, and passes only the filters the platform declares", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchImpl);
    const { call } = fixture({ config });
    expect((await call("GET", "/api/sessions?status=idle&agent_id=agt_1&secret=x")).status).toBe(200);
    const url = new URL(String(fetchImpl.mock.calls[0]?.[0]));
    expect(url.pathname).toBe("/v1/sessions");
    expect([...url.searchParams]).toEqual([["limit", "100"], ["agent_id", "agt_1"], ["status", "idle"]]);
  });

  it("resolves a parked call, and reports what the platform answered rather than assuming", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "ses_1", pending_actions: [] }), { status: 202 }),
    );
    vi.stubGlobal("fetch", fetchImpl);
    const { call } = fixture({ config });
    const decided = { tool_call_id: "call_1", decision: "deny", reason: "not this client" };
    const reply = await call("POST", "/api/sessions/ses_1/tool_confirmations", decided);
    expect(reply).toEqual({ status: 202, body: { id: "ses_1", pending_actions: [] } });
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("https://api.test/v1/sessions/ses_1/tool_confirmations");
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toEqual(decided);
  });

  it("reads what an agent has spent this period", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ agent_id: "agt_1", period: "day", spent_micro_usd: 1_250_000 }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchImpl);
    const { call } = fixture({ config });
    expect((await call("GET", "/api/agents/agt_1/spend")).body).toMatchObject({ spent_micro_usd: 1_250_000 });
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("https://api.test/v1/agents/agt_1/spend");
  });

  /**
   * The home screen's context card: the setup answers live on the latest APPLIED install of this
   * project, so the route lists installs narrowed by project, picks the newest applied one, and
   * reads its context — the day-one lines ride along from that install's report.
   */
  it("reads this project's context from its latest applied install, and says when there is none", async () => {
    const installs = [
      { id: "bpi_old", status: "applied", applied_at: "2026-09-01T00:00:00Z", report: { intake: [] } },
      { id: "bpi_failed", status: "failed", applied_at: "2026-09-09T00:00:00Z", report: null },
      {
        id: "bpi_new", status: "applied", applied_at: "2026-09-08T00:00:00Z",
        report: {
          agents: [{ name: "sales", action: "created", id: "agt_1" }, { name: "site-builder", action: "refused", reason: "no host" }],
          intake: [{ name: "sales", action: "created", id: "ses_1" }, { name: "site-builder", action: "skipped", reason: "agent refused" }],
        },
      },
    ];
    const context = { object: "project_context", answers: [{ key: "offer", label: "What does your agency sell?", value: "Paid social" }] };
    const session = { id: "ses_1", status: "idle", stop_reason: "awaiting_approval", pending_actions: [{ tool_call_id: "c1" }] };
    const fetchImpl = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(new Response(JSON.stringify(
        url.includes("/context") ? context
        : url.endsWith("/v1/sessions/ses_1") ? session
        : { data: installs, has_more: false, next_cursor: null }), { status: 200 })));
    vi.stubGlobal("fetch", fetchImpl);
    const { call } = fixture({ config });
    const reply = await call("GET", "/api/context");
    expect(reply).toEqual({
      status: 200,
      body: {
        context,
        // The team is the agents the apply left standing — the refused one is not on it.
        team: [{ name: "sales", id: "agt_1" }],
        // Each opened intake is read by its own id, so it is found long after it left the recent list.
        intake: [
          { name: "sales", action: "created", id: "ses_1", session: { status: "idle", stop_reason: "awaiting_approval", waiting: true } },
          { name: "site-builder", action: "skipped", reason: "agent refused", session: null },
        ],
      },
    });
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      expect.stringMatching(/^https:\/\/api\.test\/v1\/blueprints\/installs\?project=[\w-]+&limit=100$/),
      "https://api.test/v1/blueprints/installs/bpi_new/context",
      "https://api.test/v1/sessions/ses_1",
    ]);

    fetchImpl.mockResolvedValue(new Response(JSON.stringify({ data: [], has_more: false, next_cursor: null }), { status: 200 }));
    expect(await call("GET", "/api/context")).toEqual({ status: 404, body: { error: "no applied install for this project" } });
    // And without a key it is the same 503 as every platform-backed screen — "not configured", not an error.
    expect(await fixture().call("GET", "/api/context")).toMatchObject({ status: 503 });
  });

  it("answers 502 when the platform cannot be reached at all", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("econnrefused")));
    const { call } = fixture({ config });
    expect(await call("GET", "/api/agents")).toEqual({ status: 502, body: { error: "upstream unavailable" } });
  });
});
