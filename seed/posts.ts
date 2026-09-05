/**
 * The deliverable queue's row shapes — shared by the store (`server/store.ts`), the screens
 * (`src/data.ts`) and every template's demo seed (`templates/*.ts`). Plain types only.
 *
 * Dates are fixed ISO days so a seeded calendar renders the same month everywhere.
 */

export type PostStatus = "pending" | "ready" | "approved" | "posted" | "rejected";

export interface Post {
  id: string;
  clientId: string;
  title: string;
  summary: string;
  /**
   * The draft itself — the piece the operator is approving. Optional because an agent may file a
   * placeholder before it has written anything, and a screen that invented a body for one of those
   * would be showing the operator work nobody did: the queue says so instead.
   */
  body?: string;
  /**
   * A kind id the active template declares (`templates/index.ts`) — `article`, `audit`, `post`, …
   * A string rather than a union because the kinds are template data: a row filed under one
   * template keeps its own kind after a switch, and the screens label an unrecognised one by its id
   * rather than dropping it.
   */
  kind: string;
  channel: "blog" | "linkedin" | "x";
  status: PostStatus;
  agent: string;
  /** ISO day (YYYY-MM-DD) the piece is slotted for on the calendar. */
  scheduledFor: string;
  postedAt?: string;
  rejectedReason?: string;
  clicks?: number;
  impressions?: number;
  hue: number;
}
