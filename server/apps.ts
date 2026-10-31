/**
 * WHICH APP THIS DEPLOYMENT IS (ADR-1766). The repo is deployed once per primitive app, each with a
 * literal `APP_ID` and its own database, so each owns its data; this file says what each one serves.
 * Apps never call each other: an agent calling two apps' tools is the only bridge.
 */
import { ACTIVE, APP_IDS, type AppId } from "../templates/index.ts";

export type { AppId };

/** `APP_ID` as set on the app; unset or unknown is `crm`, the one app every template requires. */
export const appOf = (value: string | undefined): AppId =>
  (APP_IDS as readonly string[]).includes(value ?? "") ? (value as AppId) : "crm";

/** The app that files `kind` in the active template; a kind naming none is the CRM's. */
export const kindApp = (kind: string): AppId => ACTIVE.kinds.find((k) => k.id === kind)?.app ?? "crm";

/** The active template's kinds one app files. */
export const kindsOf = (app: AppId): string[] => ACTIVE.kinds.filter((k) => (k.app ?? "crm") === app).map((k) => k.id);

/** The queue tools every app that files work carries. */
const WORK = ["list_posts", "create_draft_post", "approve_post", "schedule_post", "get_calendar"];

/** Each app's MCP tools, by name; `server/mcp.ts` holds their definitions. */
export const TOOLS_OF: Record<AppId, readonly string[]> = {
  crm: ["list_clients", "get_client", "create_lead", "get_referral_link", "list_referral_ready", "record_referral_ask", "advance_pipeline", "add_client_note", "get_client_crew", "record_onboarding", ...WORK],
  "landing-page": ["get_site", "update_site", "list_new_leads", "mark_lead_filed", ...WORK],
  "seo-geo": WORK,
  ads: WORK,
  /** Meetings and deliverable due dates; it files no work of its own. */
  calendar: ["list_events", "create_event", "update_event"],
};
