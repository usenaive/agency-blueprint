/**
 * A CLIENT'S OWN TEAM, AS THE CEO HIRES IT (ADR-1766, owner's option B). The CRM holds a read key
 * and creates no agent; it answers `crm.get_client_crew` with what to hire, and the CEO hires each
 * seat with `agents_create` behind its approval card, then calls `crm.record_onboarding`.
 *
 * Every field but the name, the handoffs and the browser's domain is the template's, verbatim.
 */
import type { AgentDecl } from "@usenaive-sdk/blueprints";
import { CLIENT_DOMAIN } from "../templates/agents.ts";

type Who = { id: string; name: string; slug: string; domain: string };

/** A `POST /v1/agents` body: the declaration without its persona, which is a grant of its own (§22). */
export type AgentCreateBody = Omit<AgentDecl, "identity">;

export type ClientCrew =
  | { ok: true; create: AgentCreateBody[]; existing: string[]; identity: string | null }
  | { ok: false; reason: string };

/** A tool allow-listed to `CLIENT_DOMAIN` is allow-listed to this client's domain instead; null when it has none. */
function scopeTo<T extends Pick<AgentDecl, "tools">>(decl: T, domain: string): T | null {
  const configs = decl.tools?.configs ?? {};
  const scoped = Object.entries(configs).filter(([, tool]) => (tool.config?.allowed_domains as unknown[] | undefined)?.includes(CLIENT_DOMAIN));
  if (scoped.length === 0) return decl;
  if (domain.trim() === "") return null;
  const swap = (list: unknown[]) => list.map((d) => (d === CLIENT_DOMAIN ? domain.trim() : d));
  const rewritten = scoped.map(([name, tool]) => [name, { ...tool, config: { ...tool.config, allowed_domains: swap(tool.config!.allowed_domains as unknown[]) } }]);
  return { ...decl, tools: { ...decl.tools!, configs: { ...configs, ...Object.fromEntries(rewritten) } } };
}

/**
 * The seats to hire for `client`, named `<seat>--<slug>` with their handoffs slugged the same way.
 * A seat already on the roster (`existing`, the platform's agent names) is listed, not hired again.
 */
export function clientCrew(client: Who, crew: readonly AgentDecl[], roster: readonly string[]): ClientCrew {
  const create: AgentCreateBody[] = [];
  const existing: string[] = [];
  for (const { identity: _persona, ...seat } of crew) {
    const name = `${seat.name}--${client.slug}`;
    const scoped = scopeTo(seat, client.domain);
    if (scoped === null) return { ok: false, reason: `${client.name} has no domain, and this team's browser is limited to the client's own site` };
    if (roster.includes(name)) {
      existing.push(name);
      continue;
    }
    const handoffs = Array.isArray(scoped.handoffs) ? scoped.handoffs.map((target) => `${target}--${client.slug}`) : scoped.handoffs;
    create.push({ ...scoped, name, handoffs });
  }
  return { ok: true, create, existing, identity: crew.find((seat) => seat.identity !== undefined)?.identity ?? null };
}

/** The CEO chat Onboard opens: the sentence typed and nothing sent (ADR-1473), or no link without a studio. */
export function onboardDraft(client: Who, studioUrl: string | undefined): { draft: string; url: string | null } {
  const draft = `Onboard ${client.name} (${client.id}) from the CRM: read crm.get_client_crew for ${client.id}, hire each agent it lists exactly as written, give each the identity it names, then call crm.record_onboarding with their ids.`;
  const url = studioUrl ? `${studioUrl.replace(/\/+$/, "")}/orchestrator?${new URLSearchParams({ new: "1", draft })}` : null;
  return { draft, url };
}
