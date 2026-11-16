/**
 * The dashboard's shared vocabulary: the record types the screens render, which rows are clients, and
 * the labels for the connection kinds this agency names.
 *
 * There are no rows here (ADR-0374). Clients and posts come from `/api/clients` and `/api/posts` —
 * the app's own database, the same rows the agents write over `/mcp`; agent rosters come from
 * `/api/agents`; connected accounts from `/api/social/accounts`. Demo rows live with their
 * template and reach a screen only over HTTP, only from a local `pnpm serve`.
 *
 * The words a screen prints that change with the template — deliverable kinds, onboarding copy,
 * empty states — come from `templates/index.ts`, the browser-safe half of the template. The
 * template modules that carry the demo seed are not importable from here, by test
 * (`src/no-seed.test.ts`).
 */

import type { Client, ClientStage } from "../seed/clients";
import type { Post, PostStatus } from "../seed/posts";

export type { Client, ClientStage, Post, PostStatus };
export { ACTIVE as TEMPLATE, TEMPLATE as TEMPLATE_NAME, kindLabel } from "../templates";

/** The active clients, without the agency's own record (a name with no domain, email or CRM contact). */
export const signedClients = (clients: readonly Client[]): Client[] =>
  clients.filter((c) => c.stage === "active" && (c.domain !== "" || c.contact.email !== "" || c.crmContact !== undefined));

/** A platform agent as `/api/agents` returns it — the fields the screens read. */
export interface Agent {
  id: string;
  name: string;
  description?: string;
  model?: string;
  /** Integer micro-USD, on the agent row itself: what this agent may spend, per period and per task. */
  budget?: { cap_micro_usd: number; max_task_micro_usd: number; period: string };
}

/** A connected account as `/api/social/accounts` returns it (canonical-spec §27). */
export interface SocialAccount {
  id: string;
  platform: string;
  username: string | null;
  display_name: string | null;
  connected_at: string | null;
}

/** Display titles for the kinds this agency works with; anything else shows its platform id. */
export const CONNECTION_KINDS: { kind: string; title: string }[] = [
  { kind: "gsc", title: "Search Console" },
  { kind: "analytics", title: "Analytics" },
  { kind: "linkedin", title: "LinkedIn" },
  { kind: "x", title: "X" },
  { kind: "instagram", title: "Instagram" },
];
