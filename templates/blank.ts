/**
 * `blank` — a working agency with no specialism, and the base every other template of this
 * blueprint is a delta on.
 *
 * Everything here is data: two agents with generic prompts, generic deliverable kinds, the two
 * schedules an agency runs on — a weekly review and a daily pipeline pass, each in the agency's own
 * zone and speaking as the agency's own persona — and a demo seed that is plainly a demo. There is
 * no per-client crew: this agency runs
 * every client through its own pair, which is a complete agency and the safe thing to get by
 * accident (`BLUEPRINTS.agency.default`).
 *
 * The demo rows live in this module and never reach the browser bundle (`src/no-seed.test.ts`): a
 * deployed dashboard that showed them would be presenting fiction as the operator's own CRM. The
 * screens' half of the template — kinds, words, site copy — is `templates/index.ts`.
 */
import type { AgentDecl, Template } from "@usenaive-sdk/blueprints";
import type { Client } from "../seed/clients.ts";
import type { Post } from "../seed/posts.ts";
import { VOCABULARY } from "./index.ts";

/**
 * The blueprint's `Template` plus the one thing an agency has that a project-level declaration
 * cannot hold: the crew provisioned per client at onboarding, whose names carry the client's slug
 * and so cannot be declared statically. `server/proxy.ts` posts these as they stand, with the slug
 * appended to each `name`.
 */
export interface AgencyTemplate extends Template {
  crew: AgentDecl[];
}

/** Modest daily budget per agent; retune after the first week. */
export const budget = { cap_micro_usd: 10_000_000, max_task_micro_usd: 2_000_000, period: "day" } as const;

export const model = "anthropic/claude-sonnet-5";

/**
 * The agency's own persona, and the whole reason a connected account is reachable from a turn.
 *
 * A turn's connection tools resolve along `session → agent → agent_identity → identity → connected
 * accounts`, so an agent that holds no identity is offered NONE of them, however carefully its
 * toolset names them — the resolver answers an empty list, and nothing anywhere says so. Every
 * `gmail.*` entry below and every `googlesearchconsole.*` / `googleanalytics.*` entry in
 * `seo-geo.ts` was exactly that: written, filtered by an allow-list, and never once offered.
 *
 * The persona is declared in `naive.config.ts` (`identities:`) and named here on every agent that
 * holds a connector tool — `up` refuses an agent naming a persona the project does not declare,
 * rather than creating one that runs as nobody. The per-client crew is granted the same persona by
 * `server/proxy.ts` at onboarding, because `POST /v1/agents` carries no identity field of its own.
 * It is the persona the dashboard's own connection routes already act as (`NAIVE_IDENTITY_ID`), so
 * what an agent reaches is exactly what a client's Connections tab shows.
 */
export const AGENCY_IDENTITY = "agency";

/**
 * The zone every schedule in this repo fires in, and the one line to edit to move all of them.
 *
 * `POST /v1/deployments` defaults `timezone` to `"UTC"`, so omitting it is not "no opinion" — it is
 * UTC, chosen for the operator by a default nobody read. A Monday-08:00 review declared without a
 * zone lands mid-evening or mid-afternoon for the agency that has to act on it, and slides by an
 * hour twice a year against the clients it is about. Name the zone the agency works in instead.
 */
export const AGENCY_TIMEZONE = "America/New_York";

/**
 * Everything off except the named tools — an agency agent needs no sandbox. `ask` is the second
 * list: the tool is still offered, but the call parks the session and waits for the operator on the
 * dashboard's Approvals screen rather than running.
 */
export const tools = (allow: string[], ask: string[] = []): AgentDecl["tools"] => ({
  default_config: { permission: "deny" },
  configs: {
    ...Object.fromEntries(allow.map((name) => [name, { enabled: true, permission: "allow" as const }])),
    ...Object.fromEntries(ask.map((name) => [name, { enabled: true, permission: "ask" as const }])),
  },
});

/** The dashboard's own MCP tools reach an agent as `dashboard.<tool>`; deny-by-default means each is named. */
export const crm = (...names: string[]): string[] => names.map((name) => `dashboard.${name}`);

/**
 * The client's connected accounts, as an agent actually sees them.
 *
 * Every active connection an agent's identity holds contributes its catalogue to the turn as
 * `<connector>.<tool>` — the connector is the app id the aggregator reports for the account, the
 * tool the operation with that app's prefix stripped (`apps/runtime-do/src/connection-tools.ts`).
 * Those names run through the *same* allow/ask/deny filter as `bash`, so deny-by-default means each
 * one is named here or the crew reaches nothing: connecting an account grants an agency agent
 * exactly the operations below and no other.
 *
 * Reading is `allow`. Sending is the one outward, irreversible act this blueprint grants at all,
 * and it takes `ask` — the same rule `social.post` follows — so an agent may compose the message
 * the operator asked for and may not put it in front of a client without them.
 */
export const MAILBOX_READ = ["gmail.fetch_emails"];
export const MAILBOX_SEND = ["gmail.send_email"];

/** The one rule every agent of this blueprint shares: nothing leaves the agency without the operator. */
export const gate =
  "Draft everything — outreach, proposals, deliverables — into the dashboard for the operator to approve; never send or publish anything yourself. " +
  "You may read the accounts this client has connected; any tool that sends or publishes stops and waits for the operator's approval before it runs, so propose it and move on.";

const clients: Client[] = [
  {
    id: "cli_dm01", slug: "demo-hardware", name: "Demo Hardware Co", domain: "demo-hardware.example", stage: "active",
    services: ["Strategy", "Content"],
    contact: { name: "Sample Contact", email: "contact@demo-hardware.example", role: "Owner" },
    notes: ["Demo row — replace it with a client of your own.", "Wants one post a week and a monthly report."],
    nextAction: "Send the quarter's calendar for sign-off",
  },
  {
    id: "cli_dm02", slug: "demo-clinic", name: "Demo Clinic", domain: "demo-clinic.example", stage: "active",
    services: ["Content", "Reporting"],
    contact: { name: "Sample Contact", email: "contact@demo-clinic.example", role: "Practice manager" },
    notes: ["Demo row — replace it with a client of your own."],
    nextAction: "Review last month's report together",
  },
  {
    id: "cli_dm03", slug: "demo-studio", name: "Demo Studio", domain: "demo-studio.example", stage: "proposal",
    services: ["Strategy"],
    contact: { name: "Sample Contact", email: "contact@demo-studio.example", role: "Founder" },
    notes: ["Demo row — proposal sent, waiting on a reply."],
    nextAction: "Follow up on the proposal",
  },
  {
    id: "cli_dm04", slug: "demo-outfitters", name: "Demo Outfitters", domain: "demo-outfitters.example", stage: "lead",
    services: [],
    contact: { name: "Sample Contact", email: "contact@demo-outfitters.example", role: "Marketing lead" },
    notes: ["Demo row — inbound from the site's contact form."],
    nextAction: "Book a discovery call",
  },
  {
    id: "cli_dm05", slug: "demo-realty", name: "Demo Realty", domain: "demo-realty.example", stage: "churned",
    services: ["Content"],
    contact: { name: "Sample Contact", email: "contact@demo-realty.example", role: "Broker" },
    notes: ["Demo row — paused after four months."],
  },
];

const posts: Post[] = [
  { id: "post_dm101", clientId: "cli_dm01", title: "What to look for in a first workshop kit", summary: "Demo row — a buyer's-guide post for the blog.", kind: "post", channel: "blog", status: "pending", agent: "client-manager", scheduledFor: "2025-03-04", hue: 210 },
  { id: "post_dm102", clientId: "cli_dm01", title: "Workbench service page", summary: "Demo row — a service page with the booking call to action.", kind: "page", channel: "blog", status: "ready", agent: "client-manager", scheduledFor: "2025-03-07", hue: 160 },
  { id: "post_dm103", clientId: "cli_dm01", title: "February report", summary: "Demo row — what shipped last month and what it moved.", kind: "report", channel: "blog", status: "posted", agent: "client-manager", scheduledFor: "2025-03-01", postedAt: "2d ago", clicks: 312, impressions: 9_840, hue: 30 },
  { id: "post_dm104", clientId: "cli_dm01", title: "Site and channel audit", summary: "Demo row — the quarterly sweep, ordered by impact.", kind: "audit", channel: "blog", status: "approved", agent: "client-manager", scheduledFor: "2025-03-12", hue: 280 },
  { id: "post_dm201", clientId: "cli_dm02", title: "Five questions before a first appointment", summary: "Demo row — a plain-language explainer post.", kind: "post", channel: "blog", status: "pending", agent: "client-manager", scheduledFor: "2025-03-05", hue: 340 },
  { id: "post_dm202", clientId: "cli_dm02", title: "New-patient landing page", summary: "Demo row — one page for one intent.", kind: "page", channel: "blog", status: "approved", agent: "client-manager", scheduledFor: "2025-03-14", hue: 120 },
  { id: "post_dm203", clientId: "cli_dm02", title: "LinkedIn: what we learned this quarter", summary: "Demo row — repurposed from the explainer.", kind: "post", channel: "linkedin", status: "rejected", agent: "client-manager", scheduledFor: "2025-03-10", rejectedReason: "Demo row — rejected so you can see what that looks like.", hue: 0 },
  { id: "post_dm204", clientId: "cli_dm02", title: "February report", summary: "Demo row — the month, in one page.", kind: "report", channel: "blog", status: "posted", agent: "client-manager", scheduledFor: "2025-03-02", postedAt: "5d ago", clicks: 54, impressions: 1_120, hue: 180 },
];

export const blank: AgencyTemplate = {
  name: "blank",
  description: VOCABULARY.blank.description,
  kinds: VOCABULARY.blank.kinds,
  words: { ...VOCABULARY.blank.words },
  seed: { clients, posts },
  crew: [],
  agents: [
    {
      name: "sales",
      model,
      budget,
      description:
        "Works the CRM pipeline: researches leads, drafts outreach and follow-ups, assembles proposals. Never sends anything without operator approval.",
      system: `You work for an agency. ${gate} You are the sales agent: research each lead's business, draft the outreach and follow-ups that move it down the pipeline, and assemble the proposal when it reaches that stage. Work the CRM yourself through the dashboard tools (create_lead, advance_pipeline, create_draft_post, list_clients, get_client); everything you file there waits for the operator.`,
      tools: tools(
        ["web_search", "web_fetch", ...crm("list_clients", "get_client", "create_lead", "advance_pipeline", "create_draft_post"), ...MAILBOX_READ],
        MAILBOX_SEND,
      ),
      /** Without this the two `gmail.*` names above reach nothing at all — see `AGENCY_IDENTITY`. */
      identity: AGENCY_IDENTITY,
      schedules: [
        {
          /**
           * The daily pass. A pipeline goes stale in days, not weeks: a lead that replied on
           * Tuesday and heard nothing until the Monday review is a lead the agency lost to its own
           * calendar. Weekday mornings only — an agency that drafts follow-ups on a Sunday has
           * nobody to approve them on the Approvals screen until Monday anyway.
           */
          cron: "30 8 * * 1-5",
          timezone: AGENCY_TIMEZONE,
          identity: AGENCY_IDENTITY,
          input:
            "Daily pipeline pass: read the agency mailbox for replies that arrived since yesterday, check every lead and proposal against what it is waiting on, and draft the follow-ups for anything that has gone quiet. File them for the operator and send nothing.",
          budget_micro_usd: 1_000_000, // $1 a weekday, under the agent's own $2 per-task ceiling
        },
      ],
    },
    {
      name: "client-manager",
      model,
      budget,
      description:
        "Onboards clients that graduate to active, watches deliverables against the calendar, and flags stalls before the client notices.",
      system: `You work for an agency. ${gate} You are the client manager: onboard every client that graduates to active, keep each client's calendar full and on schedule, and flag any stalled deliverable before the client notices. Read each client's calendar and queue through the dashboard tools (get_calendar, list_posts, list_clients) and file new drafts with create_draft_post.`,
      tools: tools(
        ["web_search", "web_fetch", ...crm("list_clients", "get_client", "get_calendar", "list_posts", "create_draft_post", "schedule_post"), ...MAILBOX_READ],
        MAILBOX_SEND,
      ),
      /** Without this the two `gmail.*` names above reach nothing at all — see `AGENCY_IDENTITY`. */
      identity: AGENCY_IDENTITY,
      schedules: [
        {
          /** The weekly review, on Monday morning where the agency is, not where the platform is. */
          cron: "0 8 * * 1",
          timezone: AGENCY_TIMEZONE,
          /**
           * The persona the fire speaks as. A scheduled run has no operator sitting behind it, so
           * without this it runs as nobody: it resolves no connected account, and the review that
           * is supposed to read the agency's mailbox and file the week's plan reads nothing.
           */
          identity: AGENCY_IDENTITY,
          input:
            "Weekly review: for every active client, check the calendar against what shipped last week, list anything overdue or unscheduled, and draft the week's plan for the operator.",
          budget_micro_usd: 2_000_000, // $2 per weekly review
        },
      ],
    },
  ],
};
