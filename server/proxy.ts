/**
 * Pure proxy logic for the dashboard server: which `/api/*` paths map to which
 * platform routes, and how the upstream request is built. The org API key is
 * attached here — as an `Authorization` header on the *upstream* request only —
 * and never appears in anything sent back to the browser.
 */
import type { AgentDecl } from "@usenaive-sdk/blueprints";
import { ACTIVE_TEMPLATE } from "../templates/active.ts";

export interface Upstream {
  method: string;
  path: string;
  /** True for the session event relay — the response is piped, not buffered. */
  sse?: boolean;
}

/**
 * The only session filters that reach the platform. `GET /v1/sessions` refuses a parameter it does
 * not declare rather than dropping it (spec §9), so this is an allow-list and not a passthrough: a
 * caller cannot smuggle a filter through the dashboard that the platform would then reject.
 */
const SESSION_FILTERS = ["agent_id", "status"] as const;

/**
 * Maps a browser-facing `/api/*` request onto the platform route it fronts.
 * Social/connection routes hang off a client's identity, so they need its
 * `idn_` id; without one they are unroutable and return null (503 upstream).
 */
export function upstreamFor(
  method: string,
  pathname: string,
  identityId: string | null,
  query?: URLSearchParams,
): Upstream | null {
  if (method === "POST" && pathname === "/api/chat") return { method: "POST", path: "/v1/sessions" };
  const stream = /^\/api\/chat\/(ses_[\w-]+)\/stream$/.exec(pathname);
  if (method === "GET" && stream) {
    return { method: "GET", path: `/v1/sessions/${stream[1]}/stream`, sse: true };
  }
  // The sessions a parked approval and an agent's history are both read out of. Nothing in the
  // dashboard could see either before: a tool held at `ask` stops the session and the operator was
  // never told, and an agent's cost and its last stop reason are session fields.
  if (method === "GET" && pathname === "/api/sessions") {
    const params = new URLSearchParams({ limit: "100" });
    for (const name of SESSION_FILTERS) {
      const value = query?.get(name);
      if (value) params.set(name, value);
    }
    return { method: "GET", path: `/v1/sessions?${params}` };
  }
  // Resolving a parked call: `{ tool_call_id, decision, reason }` (`canonical-spec §7`).
  const confirm = /^\/api\/sessions\/(ses_[\w-]+)\/tool_confirmations$/.exec(pathname);
  if (method === "POST" && confirm) {
    return { method: "POST", path: `/v1/sessions/${confirm[1]}/tool_confirmations` };
  }
  // What an agent has spent this budget period, against the cap the agent itself carries.
  const spend = /^\/api\/agents\/(agt_[\w-]+)\/spend$/.exec(pathname);
  if (method === "GET" && spend) return { method: "GET", path: `/v1/agents/${spend[1]}/spend` };
  // `/api/agents` is not here: the roster is cursor-paginated upstream, so it is assembled by
  // `listAgents` below rather than relayed one page at a time.
  // Segments are strictly [\w-]+ so `..` can never traverse out of the social subtree.
  const social = /^\/api\/social((?:\/[\w-]+)+)$/.exec(pathname);
  if (social) {
    if (identityId === null) return null;
    return { method, path: `/v1/identities/${identityId}/social${social[1]}` };
  }
  return null;
}

export interface ProxyConfig {
  baseUrl: string;
  apiKey: string;
  identityId: string | null;
}

/** Reads the server's platform config from the environment; null when the key is absent. */
export function configFromEnv(env: Record<string, string | undefined>): ProxyConfig | null {
  const apiKey = env.NAIVE_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: (env.NAIVE_API_URL ?? "https://api.usenaive.ai").replace(/\/$/, ""),
    identityId: env.NAIVE_IDENTITY_ID ?? null,
  };
}

/**
 * Performs the upstream call. The key lives only in the request's
 * `Authorization` header; the returned Response is the platform's own body,
 * which never contains it.
 */
export async function proxyFetch(
  config: ProxyConfig,
  upstream: Upstream,
  body: string | null,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  return fetchImpl(`${config.baseUrl}${upstream.path}`, {
    method: upstream.method,
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      ...(body === null ? {} : { "content-type": "application/json" }),
    },
    ...(body === null ? {} : { body }),
  });
}

/** A platform agent, as much of one as this dashboard ever reads. */
export interface AgentRow {
  id: string;
  name: string;
}

/**
 * The organization's **whole** agent roster, following the cursor to the end (spec §9).
 *
 * `GET /v1/agents` pages — 20 by default, 100 at most — and an agency that has been running has one
 * three-agent crew per client on top of its own two, so page one is not the roster. Reading only it
 * is why `sales` and `client-manager` were absent from their own dashboard, why the agency chat
 * could not resolve `client-manager`, and why onboarding re-created a crew it could not see.
 *
 * Null when any page fails, never a partial roster: a half-read roster silently means "that agent
 * does not exist", which is the bug this replaces.
 */
export async function listAgents(config: ProxyConfig, fetchImpl: typeof fetch = fetch): Promise<AgentRow[] | null> {
  const all: AgentRow[] = [];
  let after: string | null = null;
  // The cursor is the platform's; the bound is ours, so an upstream that always says `has_more`
  // cannot spin a request forever. A hundred pages of a hundred is far past any real organization.
  for (let page = 0; page < 100; page += 1) {
    const query = after === null ? "?limit=100" : `?limit=100&after=${encodeURIComponent(after)}`;
    const res = await proxyFetch(config, { method: "GET", path: `/v1/agents${query}` }, null, fetchImpl);
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: AgentRow[]; has_more?: boolean; next_cursor?: string | null };
    all.push(...(body.data ?? []));
    if (body.has_more !== true || !body.next_cursor) return all;
    after = body.next_cursor;
  }
  return all;
}

export interface ProvisionReport {
  name: string;
  /** `kept`: a crew agent of some other template of this blueprint, left exactly as it is. */
  action: "created" | "unchanged" | "kept" | "failed";
}

/**
 * Upserts the active template's per-client crew (`seo-writer--<slug>`, …) by name — the same
 * semantics the blueprints reconciler uses: an agent that already exists is left untouched, a
 * missing one is created. The crew, its prompts, its model, its budget and its allow-list are all
 * template data (`templates/*.ts`); none of it is decided here.
 *
 * **Widen, never narrow.** A crew agent this client already has that the *active* template does not
 * declare — the operator switched template, or switched to `blank`, which declares no crew — is
 * reported as `kept` and never touched. Deleting an agent is an explicit act, exactly as it is in
 * the reconciler, where only a `removed:` tombstone deletes anything.
 *
 * Answers null when the roster itself cannot be read.
 */
export async function provisionClientAgents(
  config: ProxyConfig,
  slug: string,
  fetchImpl: typeof fetch = fetch,
  /** The active template's, injected like `fetchImpl` so both sides of a switch are testable. */
  crew: AgentDecl[] = ACTIVE_TEMPLATE.crew,
): Promise<ProvisionReport[] | null> {
  // The whole roster, not page one: a crew beyond the first page reads as missing and is created
  // again under the same name on every onboard.
  const roster = await listAgents(config, fetchImpl);
  if (roster === null) return null;
  const existing = new Set(roster.map((a) => a.name));
  const reports: ProvisionReport[] = [];
  const declared = new Set<string>();
  for (const member of crew) {
    const name = `${member.name}--${slug}`;
    declared.add(name);
    if (existing.has(name)) {
      reports.push({ name, action: "unchanged" });
      continue;
    }
    const created = await proxyFetch(config, { method: "POST", path: "/v1/agents" },
      JSON.stringify({ ...member, name }), fetchImpl);
    reports.push({ name, action: created.ok ? "created" : "failed" });
  }
  for (const agent of roster) {
    if (agent.name.endsWith(`--${slug}`) && !declared.has(agent.name)) reports.push({ name: agent.name, action: "kept" });
  }
  return reports;
}
