/**
 * The app's reads of the platform, under the key the platform mints for it. That key is the read
 * preset (ADR-1005, ADR-1484) and every app is read-only by construction (ADR-1766): this module
 * makes GETs and nothing else, so no app can create an agent, send a message or publish. The CEO
 * does every write, behind its approval cards. The key rides only in the upstream `Authorization`
 * header and never in anything sent back.
 */
import { PROJECT } from "../templates/index.ts";

export interface ProxyConfig {
  baseUrl: string;
  apiKey: string;
  identityId: string | null;
  /** The install this app belongs to (`NAIVE_PROJECT`, §29.7); the declaration's own name when the platform did not say. */
  project: string;
}

/** Reads the server's platform config from the environment; null when the key is absent. */
export function configFromEnv(env: Record<string, string | undefined>): ProxyConfig | null {
  const apiKey = env.NAIVE_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: (env.NAIVE_API_URL ?? "https://api.usenaive.ai").replace(/\/$/, ""),
    identityId: env.NAIVE_IDENTITY_ID ?? null,
    project: env.NAIVE_PROJECT ?? PROJECT,
  };
}

/** One GET of the platform. */
export const platformGet = (config: ProxyConfig, path: string, fetchImpl: typeof fetch = fetch): Promise<Response> =>
  fetchImpl(`${config.baseUrl}${path}`, { method: "GET", headers: { authorization: `Bearer ${config.apiKey}` } });

/** A platform agent, as much of one as this app ever reads. */
export interface AgentRow {
  id: string;
  name: string;
  current_version?: number;
}

/**
 * The organization's **whole** agent roster, following the cursor to the end (spec §9). An agency
 * that has been running has one team per client on top of its own agents, so page one is not the
 * roster, and a half-read roster reads as "that seat does not exist" — which is how a client's team
 * would be hired twice. Null when any page fails, never a partial roster.
 */
export const listAgents = (config: ProxyConfig, fetchImpl: typeof fetch = fetch): Promise<AgentRow[] | null> =>
  collect<AgentRow>(config, "/v1/agents", fetchImpl);

/**
 * Every row of one cursor-paginated platform list (`canonical-spec §3`), or null when any page
 * failed.
 */
export async function collect<T>(config: ProxyConfig, path: string, fetchImpl: typeof fetch = fetch): Promise<T[] | null> {
  const all: T[] = [];
  let after: string | null = null;
  // The cursor is the platform's; the bound is ours, so an upstream that always says `has_more`
  // cannot spin a request forever. A hundred pages of a hundred is far past any real organization.
  for (let page = 0; page < 100; page += 1) {
    const query = after === null ? "?limit=100" : `?limit=100&after=${encodeURIComponent(after)}`;
    const res = await platformGet(config, `${path}${query}`, fetchImpl);
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: T[]; has_more?: boolean; next_cursor?: string | null };
    all.push(...(body.data ?? []));
    if (body.has_more !== true || !body.next_cursor) return all;
    after = body.next_cursor;
  }
  return all;
}

/** A connected account of the agency's persona, as the SEO & GEO and Ads screens show it. */
export interface Connection {
  connector: string;
  status: string;
}

/** The persona's connected accounts, or null when the platform could not be read. No persona is none. */
export async function identityConnections(config: ProxyConfig, fetchImpl: typeof fetch = fetch): Promise<Connection[] | null> {
  if (config.identityId === null) return [];
  const res = await platformGet(config, `/v1/identities/${config.identityId}`, fetchImpl);
  if (!res.ok) return null;
  const ids = ((await res.json()) as { connections?: string[] }).connections ?? [];
  return Promise.all(ids.map(async (id) => {
    const found = await platformGet(config, `/v1/connections/${id}`, fetchImpl);
    if (!found.ok) return { connector: "unknown", status: "unavailable" };
    const value = (await found.json()) as { connector?: string; status?: string };
    return { connector: value.connector ?? "unknown", status: value.status ?? "unknown" };
  }));
}
