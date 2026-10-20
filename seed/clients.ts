/**
 * The CRM's row shapes — shared by the store (`server/store.ts`), the screens (`src/data.ts`) and
 * every template's demo seed (`templates/*.ts`).
 *
 * The rows themselves are **template data** and live with their template: a blueprint's clients
 * are the operator's, and the demo ones are a sample of what the chosen template files. Plain
 * types only; nothing here touches the DOM or node.
 */

export type PipelineStage = "lead" | "proposal" | "active" | "churned";

/** The order `advance` walks; churned is a terminal side-exit, not a step. */
export const STAGE_ORDER: readonly PipelineStage[] = ["lead", "proposal", "active", "churned"];

/**
 * Where a client first came from. `site` is the public contact form, `manual` the operator's own
 * add-a-lead form, `outreach` an agent's prospecting, `network` someone the operator already knows,
 * and `referral` an introduction from an existing client (`referredBy`). A row filed before sources
 * existed has none, and reads as unknown.
 */
export type LeadSource = "site" | "manual" | "outreach" | "network" | "referral";

export const LEAD_SOURCES: readonly LeadSource[] = ["site", "manual", "outreach", "network", "referral"];

export interface Client {
  id: string;
  /** URL-safe handle; a template's per-client crew is suffixed with it (`seo-writer--acme`). */
  slug: string;
  name: string;
  domain: string;
  stage: PipelineStage;
  services: string[];
  contact: { name: string; email: string; role: string };
  notes: string[];
  nextAction?: string;
  /** Set when the client graduates and its agents are provisioned. */
  onboardedAt?: string;
  source?: LeadSource;
  /** The client (`cli_…`) that introduced this one, when `source` is `referral`. */
  referredBy?: string;
}
