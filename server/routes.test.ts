/**
 * The route table, tested without a socket or a database — which is the reason it moved out of
 * `server/index.ts`. Both callers (`pnpm serve` and the deployed function) run exactly this.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { hashToken } from "./mcp.ts";
import { handleRequest, isLoopback, type ApiContext, type ApiRequest } from "./routes.ts";
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
    expect(writes()).toBe(1);
    expect((await call("GET", "/api/clients")).body).toHaveLength(1);

    expect(await call("POST", "/api/leads", { name: "x" })).toEqual({
      status: 400,
      body: { error: "name, domain and contact {name, email} are required" },
    });
    // A body that is not JSON at all is a validation error, never a 502.
    expect((await call("POST", "/api/leads", "{oops")).status).toBe(400);
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

  it("gates the writes too — the queue, the pipeline and a billable session alike", async () => {
    const { call, store, writes } = fixture(deployed);
    const client = store.createLead(lead);
    const before = writes();
    for (const [method, path] of [
      ["POST", "/api/leads"], ["POST", `/api/clients/${client.id}/advance`],
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
  const config = { baseUrl: "https://api.test", apiKey: "sk_test", identityId: "idn_1" };

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

  it("answers 502 when the platform cannot be reached at all", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("econnrefused")));
    const { call } = fixture({ config });
    expect(await call("GET", "/api/agents")).toEqual({ status: 502, body: { error: "upstream unavailable" } });
  });
});
