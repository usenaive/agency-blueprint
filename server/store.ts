/**
 * The dashboard's local file store: CRM clients and the content queue persist
 * as one JSON file under `data/`. Deliberately the least storage that works —
 * the upgrade path is the platform app database, noted in the README.
 */
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { REFERRAL_READY, STAGE_ORDER, type Client, type LeadSource, type PipelineStage } from "../seed/clients.ts";
import type { Post, PostStatus } from "../seed/posts.ts";
import type { CalendarEvent, EventStatus } from "../seed/events.ts";
import { sameShape, site, SITE_SECTIONS, withinBounds, type SiteProfile } from "../site/site.config.ts";
import { ACTIVE_TEMPLATE } from "../templates/active.ts";
import { kindApp, type AppId } from "./apps.ts";

export interface StoreState {
  clients: Client[];
  posts: Post[];
  /** The calendar app's rows. Absent on every other app's document. */
  events?: CalendarEvent[];
  /** The public site. Absent on a document written before the site was data; read as the seed. */
  site_profile?: SiteProfile;
  /** The public lead form's fixed window. Absent until the first lead of the first window lands. */
  lead_window?: { startedAt: number; count: number };
}

/**
 * The rate the public contact form may file leads at, and why it is in the document rather than in
 * a variable. `OPEN_LEADS_CAP` bounds how many leads may be *open* — a spend and clutter bound —
 * but it bounds nothing about how fast they arrive, so a script filed the cap's worth in one burst
 * and every genuine lead for the next day was answered `429`. A rate is the missing bound. It
 * lives in the document because the deployed entry is a function: a per-process counter resets on
 * every cold start, which is to say it does not count.
 *
 * Ten an hour is far above what an agency's own site sees and far below what a script does, and it
 * puts the better part of a day between an empty inbox and a full one — long enough that the sales
 * agent's own morning pass (`advance_pipeline`) keeps ahead of it.
 */
export const LEAD_WINDOW_MS = 60 * 60 * 1000;
export const LEADS_PER_WINDOW = 10;

/** 12 URL-safe characters (72 random bits): unguessable, and short enough to read in a link. */
const newReferralCode = (): string => randomBytes(9).toString("base64url");

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Why a client may not be asked for a referral at `now`, or null when it may (`REFERRAL_READY`).
 * Recent work is judged by its calendar slot, the one date every post carries as an ISO day.
 */
export function referralRefusal(client: Client, now: Date): string | null {
  const { activeDays, cooldownDays } = REFERRAL_READY;
  const ago = (iso: string) => (now.getTime() - new Date(iso).getTime()) / DAY_MS;
  if (client.stage !== "active") return "only an active client is asked for a referral";
  if (client.onboardedAt === undefined || ago(client.onboardedAt) < activeDays) return `a client is asked only after ${activeDays} days with the agency`;
  if (client.referralAskedAt !== undefined && ago(client.referralAskedAt) < cooldownDays) return `this client was asked less than ${cooldownDays} days ago`;
  return null;
}

/** Whole sections of the site, each replacing the current one; a key outside `SITE_SECTIONS` is refused. */
export type SitePatch = Partial<SiteProfile>;

export interface LeadInput {
  name: string;
  domain: string;
  contact: { name: string; email: string; role: string };
  services?: string[];
  note?: string;
  source?: LeadSource;
  referredBy?: string;
  /** A referral code the landing page's lead arrived with (ADR-1766). */
  ref?: string;
}

export interface DraftPostInput {
  clientId: string;
  title: string;
  summary: string;
  /** The draft itself. Absent when the agent filed only a line about it. */
  body?: string;
  kind: Post["kind"];
  /** The client's name, kept on the row by an app that does not hold the CRM. */
  clientName?: string;
  channel: Post["channel"];
  scheduledFor: string;
  agent?: string;
}

export type EventInput = Omit<CalendarEvent, "id" | "status">;
export interface EventPatch {
  title?: string;
  start?: string;
  end?: string;
  where?: string;
  notes?: string;
  status?: EventStatus;
}

export interface PostPatch {
  status?: PostStatus;
  rejectedReason?: string;
  /** ISO day (YYYY-MM-DD) — reslots the piece on the calendar. */
  scheduledFor?: string;
}

export interface Store {
  read(): StoreState;
  createLead(input: LeadInput): Client;
  /** Null when the client is not in this store, unless `anyClient` (an app whose clients are the CRM's). */
  createDraftPost(input: DraftPostInput, anyClient?: boolean): Post | null;
  advanceClient(id: string): Client | null;
  /** Appends a working note to the client and, when given, replaces what it is waiting on. */
  addClientNote(id: string, note: string, nextAction?: string): Client | null;
  /** Graduates the client to active and stamps the onboarding time; idempotent. */
  onboardClient(id: string): Client | null;
  /** Stamps that Onboard asked the CEO to hire this client's team; null for no such client. */
  requestOnboarding(id: string): Client | null;
  /** Landing page: marks a lead filed into the CRM; idempotent, null for no such lead. */
  markLeadFiled(id: string): Client | null;
  /** Calendar: adds a meeting or a deliverable's due date, scheduled. */
  createEvent(input: EventInput): CalendarEvent;
  /** Calendar: reschedules, renotes or closes an event; null for no such event. */
  updateEvent(id: string, patch: EventPatch): CalendarEvent | null;
  /**
   * The client's referral code, stamped now when it has none (a client onboarded before links
   * existed). Null for a client that does not exist or is not active: only a client the agency works
   * for is asked to refer.
   */
  referralCode(id: string): string | null;
  /** The active clients ready to be asked for an introduction at `now` (`REFERRAL_READY`). */
  referralReady(now: Date): Client[];
  /** Stamps the ask on a ready client; says why when the client is not ready (the rule, or the cooldown). */
  recordReferralAsk(id: string, now: Date): { client: Client } | { refused: string };
  updatePost(id: string, patch: PostPatch): Post | null;
  /**
   * Counts one public lead against the current window and says whether it may be filed. False is
   * "not now", never "not ever": the window rolls.
   */
  admitLead(now: number): boolean;
  /** The public site as `GET /api/site` serves it. */
  site(): SiteProfile;
  /** Replaces the named sections; null when a key is not a section or a section is not the right shape. */
  updateSite(patch: Record<string, unknown>): SiteProfile | null;
}

/**
 * The active template's demo agency, for the local file store only (`openStore`). It never reaches
 * a deployment and never reaches the client bundle: seed rows are the template's sample, not the
 * operator's data, and a deployed dashboard that showed them would be presenting fiction as the
 * customer's CRM.
 */
export const seedState = (app: AppId = "crm"): StoreState => ({
  // The CRM holds the clients; the landing page's inbox holds the leads; the others hold none.
  clients: structuredClone((ACTIVE_TEMPLATE.seed.clients as Client[]).filter((c) => app === "crm" || (app === "landing-page" && c.stage === "lead"))),
  posts: structuredClone((ACTIVE_TEMPLATE.seed.posts as Post[]).filter((p) => kindApp(p.kind) === app)),
  site_profile: structuredClone(site),
  ...(app === "calendar" ? { events: seedEvents() } : {}),
});

/** The demo calendar: each seeded deliverable on its due day, and a weekly check-in per active client. */
function seedEvents(): CalendarEvent[] {
  const clients = ACTIVE_TEMPLATE.seed.clients as Client[];
  const name = (id: string) => clients.find((c) => c.id === id)?.name;
  const due = (ACTIVE_TEMPLATE.seed.posts as Post[]).map((p, i): CalendarEvent => ({
    id: `evt_d${i}`, kind: "deliverable", title: p.title, clientId: p.clientId, clientName: name(p.clientId),
    start: p.scheduledFor, app: kindApp(p.kind), ref: p.id, status: p.status === "posted" ? "done" : p.status === "rejected" ? "cancelled" : "scheduled",
  }));
  const meetings = clients.filter((c) => c.stage === "active").map((c, i): CalendarEvent => ({
    id: `evt_m${i}`, kind: "meeting", title: `Weekly check-in with ${c.name}`, clientId: c.id, clientName: c.name,
    start: `2026-11-0${3 + (i % 3)}T15:00:00Z`, end: `2026-11-0${3 + (i % 3)}T15:30:00Z`, where: "Video call", status: "scheduled",
  }));
  return [...meetings, ...due];
}

/**
 * What a fresh **deployed** document is created with: no rows, because nothing has happened yet,
 * and the active template's generic site — which claims nothing about anyone and is what the
 * site-builder rewrites from the setup answers on day one.
 */
export const emptyState = (): StoreState => ({ clients: [], posts: [], site_profile: structuredClone(site) });

/** The stage after `stage` on the happy path; churned only ever by hand. */
const next = (stage: PipelineStage): PipelineStage | null => {
  const candidate = STAGE_ORDER[STAGE_ORDER.indexOf(stage) + 1];
  return candidate === undefined || candidate === "churned" ? null : candidate;
};

/** Opens (and on first run seeds with `app`'s share of the demo) the JSON store at `file`. */
export function openStore(file: string, app: AppId = "crm"): Store {
  let state: StoreState;
  try {
    state = JSON.parse(readFileSync(file, "utf8")) as StoreState;
  } catch {
    state = seedState(app);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(state, null, 2));
  }
  return openStoreOver(state, (next) => writeFileSync(file, JSON.stringify(next, null, 2)));
}

/**
 * The store's behaviour over a state that is already in hand, with persistence injected.
 *
 * The file store above is one caller; the deployed app's is the other — a serverless request has
 * no durable disk, so it loads the document from the app database, runs exactly this logic, and
 * writes the document back (`api/app` in the deploy tree). Keeping one implementation is why
 * `routes.ts` and every screen behave identically in both.
 */
export function openStoreOver(state: StoreState, persist: (state: StoreState) => void): Store {
  const save = () => persist(state);
  const nameOnly = (row: { domain: string; contact: { email: string } }) => row.domain === "" && row.contact.email === "";

  // Older installs allowed each intake to choose a different label for the agency itself. The CRM
  // has clients; it has exactly one internal workspace. Consolidate those legacy rows under the
  // first durable id, retaining their notes/services and repointing every queued deliverable.
  const internal = state.clients.filter(nameOnly);
  if (internal.length > 1) {
    const keeper = internal[0]!;
    const duplicates = new Set(internal.slice(1).map((row) => row.id));
    keeper.notes = [...new Set(internal.flatMap((row) => row.notes))];
    keeper.services = [...new Set(internal.flatMap((row) => row.services))];
    keeper.nextAction ??= internal.find((row) => row.nextAction !== undefined)?.nextAction;
    for (const post of state.posts) if (duplicates.has(post.clientId)) post.clientId = keeper.id;
    state.clients = state.clients.filter((row) => !duplicates.has(row.id));
    save();
  }

  return {
    read: () => state,
    createLead(input) {
      const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "client";
      // A name alone files the agency's own record; a second filing lands on the first. Only a row
      // filed the same way is the first: a prospect with a domain or a contact is never it.
      // Name is not identity here: independent agents may call the same workspace "agency",
      // project name, or public brand. A name-only row is always the one internal workspace.
      const twin = nameOnly(input) ? state.clients.find(nameOnly) : undefined;
      if (twin) {
        if (input.note !== undefined) {
          twin.notes.push(input.note);
          save();
        }
        return twin;
      }
      const client: Client = {
        id: `cli_${randomBytes(4).toString("hex")}`,
        slug,
        name: input.name,
        domain: input.domain,
        stage: "lead",
        services: input.services ?? [],
        contact: input.contact,
        notes: input.note === undefined ? [] : [input.note],
        // The agency's own name-only record is not a lead, so it has no source.
        ...(input.source && !nameOnly(input) ? { source: input.source } : {}),
        ...(input.referredBy && !nameOnly(input) ? { referredBy: input.referredBy } : {}),
        ...(input.ref && !nameOnly(input) ? { ref: input.ref } : {}),
      };
      state.clients.push(client);
      save();
      return client;
    },
    createDraftPost(input, anyClient = false) {
      if (!anyClient && !state.clients.some((c) => c.id === input.clientId)) return null;
      const post: Post = {
        id: `post_${randomBytes(4).toString("hex")}`,
        clientId: input.clientId,
        ...(input.clientName === undefined ? {} : { clientName: input.clientName }),
        title: input.title,
        summary: input.summary,
        ...(input.body === undefined ? {} : { body: input.body }),
        kind: input.kind,
        channel: input.channel,
        status: "pending",
        agent: input.agent ?? "mcp",
        scheduledFor: input.scheduledFor,
        hue: Math.floor(Math.random() * 360),
      };
      state.posts.push(post);
      save();
      return post;
    },
    advanceClient(id) {
      const client = state.clients.find((c) => c.id === id);
      if (!client) return null;
      const to = next(client.stage);
      if (to === null) return client;
      client.stage = to;
      // Active by the pipeline is onboarded too: the referral rule's 30 days count from this stamp.
      if (to === "active") client.onboardedAt ??= new Date().toISOString();
      save();
      return client;
    },
    addClientNote(id, note, nextAction) {
      const client = state.clients.find((c) => c.id === id);
      if (!client) return null;
      client.notes.push(note);
      if (nextAction !== undefined) client.nextAction = nextAction;
      save();
      return client;
    },
    onboardClient(id) {
      const client = state.clients.find((c) => c.id === id);
      if (!client || client.stage === "churned") return client ?? null;
      client.stage = "active";
      client.onboardedAt ??= new Date().toISOString();
      delete client.onboardingRequestedAt;
      client.referralCode ??= newReferralCode();
      save();
      return client;
    },
    requestOnboarding(id) {
      const client = state.clients.find((c) => c.id === id);
      if (!client) return null;
      client.onboardingRequestedAt = new Date().toISOString();
      save();
      return client;
    },
    markLeadFiled(id) {
      const client = state.clients.find((c) => c.id === id);
      if (!client) return null;
      if (client.filed !== true) {
        client.filed = true;
        save();
      }
      return client;
    },
    createEvent(input) {
      const event: CalendarEvent = { ...input, id: `evt_${randomBytes(4).toString("hex")}`, status: "scheduled" };
      (state.events ??= []).push(event);
      save();
      return event;
    },
    updateEvent(id, patch) {
      const event = (state.events ?? []).find((e) => e.id === id);
      if (!event) return null;
      for (const key of ["title", "start", "end", "where", "notes", "status"] as const) {
        if (patch[key] !== undefined) (event as unknown as Record<string, unknown>)[key] = patch[key];
      }
      save();
      return event;
    },
    referralCode(id) {
      const client = state.clients.find((c) => c.id === id);
      if (!client || client.stage !== "active") return null;
      if (client.referralCode === undefined) {
        client.referralCode = newReferralCode();
        save();
      }
      return client.referralCode;
    },
    referralReady(now) {
      return state.clients.filter((c) => referralRefusal(c, now) === null);
    },
    recordReferralAsk(id, now) {
      const client = state.clients.find((c) => c.id === id);
      if (!client) return { refused: "no such client" };
      const refused = referralRefusal(client, now);
      if (refused !== null) return { refused };
      client.referralAskedAt = now.toISOString();
      save();
      return { client };
    },
    updatePost(id, patch) {
      const post = state.posts.find((p) => p.id === id);
      if (!post) return null;
      if (patch.status !== undefined) post.status = patch.status;
      if (patch.scheduledFor !== undefined) post.scheduledFor = patch.scheduledFor;
      if (patch.status === "posted") {
        post.postedAt = "just now";
        post.clicks ??= 0;
        post.impressions ??= 0;
      }
      if (patch.status === "rejected") post.rejectedReason = patch.rejectedReason ?? "Rejected by you";
      save();
      return post;
    },
    admitLead(now) {
      const window = state.lead_window;
      if (window === undefined || now - window.startedAt >= LEAD_WINDOW_MS) {
        state.lead_window = { startedAt: now, count: 1 };
        save();
        return true;
      }
      if (window.count >= LEADS_PER_WINDOW) return false;
      window.count += 1;
      save();
      return true;
    },
    site: () => state.site_profile ?? site,
    updateSite(patch) {
      const keys = Object.keys(patch);
      if (keys.length === 0) return null;
      const current = state.site_profile ?? structuredClone(site);
      for (const key of keys) {
        // Shape first, then size: `sameShape` has no opinion about how long a string may be, and
        // the section it is judging is about to become the live public page.
        if (!(SITE_SECTIONS as readonly string[]).includes(key)) return null;
        if (!sameShape(site[key as keyof SiteProfile], patch[key]) || !withinBounds(patch[key])) return null;
      }
      state.site_profile = { ...current, ...(patch as SitePatch) };
      save();
      return state.site_profile;
    },
  };
}
