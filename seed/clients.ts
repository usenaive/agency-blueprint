/**
 * The signed clients' row shapes — shared by the store (`server/store.ts`), the screens (`src/data.ts`) and
 * every template's demo seed (`templates/*.ts`).
 *
 * The rows themselves are **template data** and live with their template: a blueprint's clients
 * are the operator's, and the demo ones are a sample of what the chosen template files. Plain
 * types only; nothing here touches the DOM or node.
 */

/**
 * A signed client is `active`; `churned` is one the agency no longer works for. The sales pipeline —
 * leads, talks, proposals — is the platform CRM's (`crm.read`, `crm.write`), never this store's: a
 * contact the CRM marks won becomes a row here (`create_client`).
 */
export type ClientStage = "active" | "churned";

export interface Client {
  id: string;
  /** URL-safe handle; a template's per-client crew is suffixed with it (`seo-writer--acme`). */
  slug: string;
  name: string;
  domain: string;
  stage: ClientStage;
  services: string[];
  contact: { name: string; email: string; role: string };
  notes: string[];
  nextAction?: string;
  /** Set when the client is onboarded and its agents are provisioned. */
  onboardedAt?: string;
  /** The platform CRM contact (`ctc_…`) this client was won as; one client per contact. */
  crmContact?: string;
  /**
   * The private code in this client's referral link (`/?ref=…`). Random, never the slug, so a link
   * cannot be made from a name. Stamped when the client goes active.
   */
  referralCode?: string;
  /** When this client was last asked for an introduction (ISO time); the cooldown counts from it. */
  referralAskedAt?: string;
}

/**
 * When a client is ready to be asked for a referral (plan P3): long enough with the agency, recent
 * work they approved, nothing they turned down since, and not asked lately. Asking an unhappy or a
 * brand-new client costs more trust than any introduction brings.
 */
export const REFERRAL_READY = { activeDays: 30, recentDays: 60, minApproved: 2, cooldownDays: 90 } as const;
