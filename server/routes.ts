/**
 * Every route this dashboard answers, in one table over one store (ADR-0374).
 *
 * `server/index.ts` (node `http`, `pnpm serve`) and `server/api-entry.ts` (the deployed function)
 * are thin adapters: each builds an `ApiRequest`, calls `handleRequest`, and writes the `ApiReply`.
 * Neither holds a route, so `/mcp` and `/api/*` are the same rows of the same document by
 * construction — an agent's CRM write is what the UI reads back.
 *
 * Nothing here touches a socket, a file or a database: the store arrives through `ctx.store()`,
 * which the entry opens lazily, so the platform-only routes cost no connection at all.
 */
import { authorized, bearerOf, handleMcp, mintToken, sameSecret } from "./mcp.ts";
import { listAgents, provisionClientAgents, proxyFetch, upstreamFor, type ProxyConfig } from "./proxy.ts";
import type { LeadInput, PostPatch, Store } from "./store.ts";

export interface ApiRequest {
  /** Upper-case. */
  method: string;
  /** "/api/clients" or "/mcp"; no query, no trailing slash. */
  path: string;
  query: URLSearchParams;
  /** Lower-cased names, first value only. */
  headers: Record<string, string | undefined>;
  /** Raw text, "" when there is none. */
  body: string;
}

export interface ApiReply {
  status: number;
  /** JSON-encoded; undefined means an empty body. */
  body?: unknown;
  /** Set only by `/api/chat/:sid/stream` — piped, not buffered. */
  stream?: Response;
}

export interface ApiContext {
  /** Opens the store on first call and memoises it for this request. Platform-only routes never call it. */
  store(): Promise<Store>;
  config: ProxyConfig | null;
  /** `VETTA_MCP_TOKEN` — the bearer the platform minted for this app's agents. */
  mcpToken: string | undefined;
  /**
   * `DASHBOARD_TOKEN` — the operator's bearer for every `/api/*` route. Separate from `mcpToken`
   * on purpose: the agents' credential is minted by the platform and is not the operator's.
   */
  dashboardToken: string | undefined;
  /** True on `pnpm serve` / `pnpm dev`. False in the deployed function. */
  local: boolean;
}

/**
 * Every relayed stream opens with this, so the browser's `EventSource` reconnects cheaply when the
 * function hits its duration ceiling instead of backing off to the default three seconds' guesswork.
 */
export const SSE_RETRY = "retry: 3000\n\n";

const NO_ROUTE: ApiReply = { status: 404, body: { error: "no such route" } };
const NOT_ALLOWED: ApiReply = { status: 405, body: { error: "method not allowed" } };
const NOT_CONFIGURED: ApiReply = { status: 503, body: { error: "not configured — set NAIVE_API_KEY" } };
const UNAUTHENTICATED: ApiReply = { status: 401, body: { error: "missing or invalid access token" } };
const NO_GATE: ApiReply = { status: 503, body: { error: "not configured — set DASHBOARD_TOKEN" } };

/** A malformed body is a validation error, never a 502 — the route below decides which one. */
const parse = (body: string): Record<string, unknown> => {
  try {
    return (JSON.parse(body || "{}") ?? {}) as Record<string, unknown>;
  } catch {
    return {};
  }
};

/** The MCP endpoint: bearer-gated JSON-RPC over POST, on the same document as every `/api/*` row. */
async function mcpRoute(req: ApiRequest, ctx: ApiContext): Promise<ApiReply> {
  if (req.method !== "POST") return { status: 405, body: { error: "POST only" } };
  const store = await ctx.store();
  if (!authorized(store, req.headers.authorization, ctx.mcpToken)) {
    return { status: 401, body: { error: "missing or invalid bearer token" } };
  }
  const answer = await handleMcp(req.body, store, ctx.config);
  // A notification has no reply: 202 with no body, as the streamable-HTTP transport asks.
  return answer === null ? { status: 202 } : { status: 200, body: answer };
}

/**
 * Token minting for the Settings screen — **local only**. Minting is unauthenticated (the dashboard
 * has no user auth), so on a public URL it would hand any visitor this app's agent tools. The
 * platform already mints and injects `VETTA_MCP_TOKEN` on the deployment, so nothing is lost there.
 */
async function tokenRoutes(req: ApiRequest, ctx: ApiContext): Promise<ApiReply | null> {
  if (!req.path.startsWith("/api/mcp/tokens")) return null;
  if (!ctx.local) return NO_ROUTE;
  const store = await ctx.store();
  if (req.path === "/api/mcp/tokens") {
    if (req.method === "GET") {
      return { status: 200, body: store.mcpTokens().map(({ id, name, createdAt }) => ({ id, name, createdAt })) };
    }
    if (req.method !== "POST") return NOT_ALLOWED;
    const { name } = parse(req.body) as { name?: string };
    if (!name) return { status: 400, body: { error: "name is required" } };
    return { status: 201, body: mintToken(store, name) };
  }
  const revoke = /^\/api\/mcp\/tokens\/([\w-]+)$/.exec(req.path);
  if (revoke === null) return NO_ROUTE;
  if (req.method !== "DELETE") return NOT_ALLOWED;
  return store.removeMcpToken(revoke[1]!)
    ? { status: 200, body: { ok: true } }
    : { status: 404, body: { error: "no such token" } };
}

/** The store-backed routes: the CRM pipeline and the content queue. */
async function storeRoutes(req: ApiRequest, ctx: ApiContext): Promise<ApiReply | null> {
  const { method, path } = req;

  if (path === "/api/clients") {
    return method === "GET" ? { status: 200, body: (await ctx.store()).read().clients } : NOT_ALLOWED;
  }
  if (path === "/api/posts") {
    return method === "GET" ? { status: 200, body: (await ctx.store()).read().posts } : NOT_ALLOWED;
  }
  // The public site's contact form lands here as a CRM lead.
  if (path === "/api/leads") {
    if (method !== "POST") return NOT_ALLOWED;
    const body = parse(req.body) as Partial<LeadInput>;
    if (!body.name || !body.domain || !body.contact?.name || !body.contact.email) {
      return { status: 400, body: { error: "name, domain and contact {name, email} are required" } };
    }
    return { status: 201, body: (await ctx.store()).createLead(body as LeadInput) };
  }

  const advance = /^\/api\/clients\/([\w-]+)\/advance$/.exec(path);
  if (advance) {
    if (method !== "POST") return NOT_ALLOWED;
    const client = (await ctx.store()).advanceClient(advance[1]!);
    return client ? { status: 200, body: client } : { status: 404, body: { error: "no such client" } };
  }

  const onboard = /^\/api\/clients\/([\w-]+)\/onboard$/.exec(path);
  if (onboard) {
    if (method !== "POST") return NOT_ALLOWED;
    const client = (await ctx.store()).onboardClient(onboard[1]!);
    if (!client) return { status: 404, body: { error: "no such client" } };
    if (client.stage !== "active") return { status: 409, body: { error: "a churned client cannot be onboarded" } };
    // With a key present, fan out the client's crew on the platform; without one the store move
    // still lands, so the pipeline works before the key does.
    const agents = ctx.config === null ? null : await provisionClientAgents(ctx.config, client.slug);
    return { status: 200, body: { client, agents } };
  }

  const postNow = /^\/api\/posts\/([\w-]+)\/post-now$/.exec(path);
  if (postNow) {
    if (method !== "POST") return NOT_ALLOWED;
    const store = await ctx.store();
    const post = store.read().posts.find((p) => p.id === postNow[1]);
    if (!post) return { status: 404, body: { error: "no such post" } };
    // When the platform is configured, publish for real before marking posted.
    const upstream = ctx.config === null ? null : upstreamFor("POST", "/api/social/posts", ctx.config.identityId);
    if (ctx.config !== null && upstream !== null) {
      const published = await proxyFetch(ctx.config, upstream, JSON.stringify({
        content: post.summary, title: post.title, platforms: [post.channel],
      }));
      if (!published.ok) return { status: 502, body: { error: "publish failed" } };
    }
    return { status: 200, body: store.updatePost(post.id, { status: "posted" }) };
  }

  const patch = /^\/api\/posts\/([\w-]+)$/.exec(path);
  if (patch) {
    if (method !== "PATCH") return NOT_ALLOWED;
    const body = parse(req.body) as PostPatch;
    if (!body.status && !body.scheduledFor) return { status: 400, body: { error: "status or scheduledFor is required" } };
    const updated = (await ctx.store()).updatePost(patch[1]!, {
      status: body.status, rejectedReason: body.rejectedReason, scheduledFor: body.scheduledFor,
    });
    return updated ? { status: 200, body: updated } : { status: 404, body: { error: "no such post" } };
  }

  return null;
}

/** Resolved once per instance: the agent the agency chat talks to. */
let chatAgent: string | null = null;
async function chatAgentId(config: ProxyConfig): Promise<string | null> {
  if (chatAgent !== null) return chatAgent;
  // The whole roster: `client-manager` is one row among an agency's hundreds, and resolving it over
  // page one alone answered "no client-manager agent in this organization" for an org that has one.
  const roster = await listAgents(config);
  if (roster === null) return null;
  chatAgent = roster.find((a) => a.name === "client-manager")?.id ?? null;
  return chatAgent;
}

/**
 * Everything that needs the org's key: chat, the agent roster, an agent's spend, the sessions
 * behind the approval queue and the agent history, and the client's social accounts.
 */
const PLATFORM_ROUTE = /^\/api\/(chat|agents|social|sessions)(\/|$)/;

async function platformRoutes(req: ApiRequest, ctx: ApiContext): Promise<ApiReply> {
  if (!PLATFORM_ROUTE.test(req.path)) return NO_ROUTE;
  const config = ctx.config;
  if (config === null) return NOT_CONFIGURED;
  try {
    if (req.method === "POST" && req.path === "/api/chat") {
      const agent = await chatAgentId(config);
      if (agent === null) return { status: 503, body: { error: "no client-manager agent in this organization" } };
      const message = parse(req.body).message;
      const created = await proxyFetch(config, { method: "POST", path: "/v1/sessions" },
        JSON.stringify({ agent_id: agent, message: typeof message === "string" ? message : "" }));
      return { status: created.status, body: await created.json() };
    }
    if (req.method === "GET" && req.path === "/api/agents") {
      // Assembled here rather than relayed: the upstream pages at 20, so the screen that lists the
      // agency's own agents was showing whichever twenty came first — never `sales`, on a real org.
      const roster = await listAgents(config);
      if (roster === null) return { status: 502, body: { error: "upstream unavailable" } };
      return { status: 200, body: { data: roster, has_more: false, next_cursor: null } };
    }
    const upstream = upstreamFor(req.method, req.path, config.identityId, req.query);
    if (upstream === null) return NO_ROUTE;
    const answer = await proxyFetch(config, upstream, req.method === "GET" ? null : req.body || "{}");
    if (upstream.sse) return { status: answer.status, stream: answer };
    return { status: answer.status, body: await answer.json() };
  } catch {
    return { status: 502, body: { error: "upstream unavailable" } };
  }
}

/**
 * The one thing allowed to stand in for the operator's token, and the whole of what `ctx.local`
 * may be built from: a caller on the loopback interface.
 *
 * `createServer().listen(port)` binds *every* interface, so "the local server answered it" is not
 * the same fact as "the request came from this machine" — a peer on the LAN, or anything pointed
 * through a tunnel, is neither. Taken from the socket, never from a header or a proxy hop, because
 * everything a caller can write is a claim rather than a fact. The deployed entry calls none of
 * this: it hard-codes `local: false`.
 */
export const isLoopback = (remoteAddress: string | undefined): boolean =>
  remoteAddress === "127.0.0.1" || remoteAddress === "::1" || remoteAddress === "::ffff:127.0.0.1";

/**
 * The gate on the whole `/api/*` surface: `Authorization: Bearer <DASHBOARD_TOKEN>`, compared in
 * constant time. Null admits the request; anything else is the reply.
 *
 * Without it the deployment is a public URL that hands anyone who finds it the CRM (client names,
 * domains, contacts and their email addresses), the org's agent roster with its system prompts,
 * the content queue as a *writable* surface, and the relay of any session in the organization.
 *
 * Two rules it never bends:
 *   * **Fail closed.** No token configured on a deployment is 503, never open. A missing credential
 *     must never mean "let everyone in" — that is precisely the bug being fixed.
 *   * **Local means local.** `pnpm serve` with nothing set stays usable, and `ctx.local` comes from
 *     `isLoopback` on the request's own socket; the deployed entry hard-codes it false, so no
 *     header, host or proxy hop a caller controls can claim it.
 *
 * `/mcp` never reaches here: the agents' bearer is its own credential and is unchanged.
 */
function apiGate(req: ApiRequest, ctx: ApiContext): ApiReply | null {
  if (!ctx.dashboardToken) return ctx.local ? null : NO_GATE;
  const token = bearerOf(req.headers.authorization);
  return token !== null && sameSecret(token, ctx.dashboardToken) ? null : UNAUTHENTICATED;
}

/** The whole route table, in order: `/mcp`, the gate, the local token routes, the store, the platform. */
export async function handleRequest(req: ApiRequest, ctx: ApiContext): Promise<ApiReply> {
  if (req.path === "/mcp") return mcpRoute(req, ctx);
  if (!req.path.startsWith("/api/")) return NO_ROUTE;
  // Before the route table, so an unauthenticated caller cannot even map which routes exist.
  const denied = apiGate(req, ctx);
  if (denied !== null) return denied;
  return (await tokenRoutes(req, ctx)) ?? (await storeRoutes(req, ctx)) ?? platformRoutes(req, ctx);
}
