/**
 * The calendar app's rows (ADR-1766): client meetings, and the dates client deliverables are due.
 * A deliverable's row points at the work it stands for (`app` + `ref`, a `post_` id in that app);
 * the work itself stays in its own app, so the calendar never holds a second copy of it.
 */
import type { AppId } from "../templates/index.ts";

export type EventKind = "meeting" | "deliverable";
export type EventStatus = "scheduled" | "done" | "cancelled";

export interface CalendarEvent {
  id: string;
  kind: EventKind;
  title: string;
  /** The CRM's `cli_…`; the client is the CRM's, so its name rides along as the agent gave it. */
  clientId: string;
  clientName?: string;
  /** ISO day (`YYYY-MM-DD`) for a deliverable, ISO date-time for a meeting. */
  start: string;
  end?: string;
  /** A meeting's link or place. */
  where?: string;
  /** A deliverable's app and the `post_` id it stands for there. */
  app?: AppId;
  ref?: string;
  notes?: string;
  status: EventStatus;
}

export const EVENT_KINDS: readonly EventKind[] = ["meeting", "deliverable"];
export const EVENT_STATUSES: readonly EventStatus[] = ["scheduled", "done", "cancelled"];
