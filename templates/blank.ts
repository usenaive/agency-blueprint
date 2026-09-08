/**
 * `blank` — a working agency with no specialism, and the base every other template of this
 * blueprint is a delta on.
 *
 * Everything here is data: a seven-agent team with generic prompts — sales, client manager,
 * strategist, researcher, content writer, editor, analytics reporter — generic deliverable kinds,
 * the schedules an agency runs on (a daily pipeline pass, a weekly review, the writing and edit
 * passes, the monthly report), each in the agency's own zone and speaking as the agency's own
 * persona, and a demo seed that is plainly a demo. There is no per-client crew: this agency runs
 * every client through its own team, which is a complete agency and the safe thing to get by
 * accident (`BLUEPRINTS.agency.default`).
 *
 * The team is `agents`, not `crew`, on purpose: `defineProject` folds only a template's `agents`
 * into the declaration `naive up` applies and the catalog publishes, so an agent declared anywhere
 * else is one the dashboard's template card never shows.
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
 * appended to each `name`. The SDK's `Template` has no such field, so `crew` never reaches the
 * published artifact — it is this repo's, and the agency-wide team belongs in `agents`.
 */
export interface AgencyTemplate extends Template {
  crew: AgentDecl[];
}

/** Modest daily budget per agent; retune after the first week. */
export const budget = { cap_micro_usd: 10_000_000, max_task_micro_usd: 2_000_000, period: "day" } as const;

export const model = "anthropic/claude-sonnet-5";

/**
 * The agency's own persona, and the whole reason a mailbox or a connected account is reachable
 * from a turn.
 *
 * A turn's identity tools resolve along `session → agent → agent_identity → identity → {inboxes,
 * connected accounts}`, so an agent that holds no identity is offered NONE of them, however
 * carefully its toolset names them — the resolver answers an empty list, and nothing anywhere
 * says so. Every mailbox entry below and every `googlesearchconsole.*` / `googleanalytics.*`
 * entry in `seo-geo.ts` was exactly that: written, filtered by an allow-list, and never once
 * offered.
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
 * The agency mailbox, as an agent actually sees it.
 *
 * The mailbox is the persona's OWN inbox on the platform's mail layer — provisioned once on the
 * `agency` identity (`vetta identity email provision`, or the platform dashboard), addressed on the
 * org's system domain or a domain the agency verified, with inbound mail stored per identity. A
 * turn whose identity owns an inbox is offered `email.inboxes` (which addresses exist),
 * `email.read` (stored replies, newest first, `since` to bound them) and, where the deployment's
 * mail provider is configured, `email.send`. A turn whose identity owns no inbox is offered none
 * of the three — the tools are not "present but empty", they are absent, and the prompt below
 * tells the agent what that absence means.
 *
 * `gmail.*` is NOT this. Gmail is one toolkit of the connections aggregator: it reads the
 * operator's own Google account after they OAuth it into the persona from the Connections tab, and
 * reaches a turn as `<connector>.<tool>` (`apps/runtime-do/src/connection-tools.ts`). An agency
 * that wants its agents in a real Gmail account names those operations here too — they run
 * through the same allow/ask/deny filter, so an unnamed one is a connection nobody can use.
 *
 * Reading is `allow`. Sending is the one outward, irreversible act this blueprint grants at all,
 * and it takes `ask` — the same rule `social.post` follows — so an agent may compose the message
 * the operator asked for and may not put it in front of a client without them.
 */
export const MAILBOX_READ = ["email.inboxes", "email.read"];
export const MAILBOX_SEND = ["email.send"];

/**
 * The one way an agent may ask for something it does not have. The call parks the session on the
 * Approvals screen with the question attached; the operator's answer wakes it. It is `ask` by
 * construction — `allow` is not a coherent policy for a tool whose body is the pause — so it goes
 * in the second list. Without it, an agent missing a tool has exactly two options: guess, or write
 * a paragraph into its final answer that nobody is waiting for.
 */
export const ASK_OPERATOR = ["ask_operator"];

/**
 * The one way an agent may change what it holds. `request_tools` names the exact tools (and, for
 * `generate_video`, the models) the task needs and why; the call parks on the Approvals screen as
 * an ordinary tool card, and approving it mints a new agent version and re-pins the running session
 * so the tool is offered from the next turn (canonical-spec §7.4). It is `ask` by construction and
 * a session-wide grant never covers it. `ask_operator` asks a person a question; this asks for a
 * capability — an agent told only to "ask" for a missing tool has no way to be granted one.
 */
export const REQUEST_TOOLS = ["request_tools"];

/** Both operator doors, for the `ask` list of every agent. */
export const OPERATOR = [...ASK_OPERATOR, ...REQUEST_TOOLS];

/** The one rule every agent of this blueprint shares: nothing leaves the agency without the operator. */
export const gate =
  "Draft everything — outreach, proposals, deliverables — into the dashboard for the operator to approve; never send or publish anything yourself. " +
  "Any tool that sends or publishes stops and waits for the operator's approval before it runs, so propose it and move on. " +
  "The tools offered to you this turn are the complete list of what you can do right now: do not assume a capability that is not in it, and do not invent one. " +
  "If the task needs a tool or model you are not offered — generate_video and a video model, email.read, a connector's tool — request it once with request_tools, naming the exact tool, permission and reason, then wait: approval adds it to your toolset from the next turn, a refusal is final for this task. " +
  "If the task needs a fact or a decision only the operator has — which inbox, which client, whether to proceed — ask once with ask_operator, in one message, then wait. " +
  "A tool you were granted can still be short of an account, an inbox or a provider; when it says so, report that exactly rather than requesting the tool again.";

/**
 * What the mailbox is, in the words an agent needs when it goes to read it. Kept out of `gate`
 * because only the agents that work the mailbox — sales, the client manager, outreach — hold it,
 * and the rest of the team should not be told it does.
 */
export const mailbox =
  "The agency mailbox is the agency persona's own inbox: email.inboxes lists its addresses, email.read returns the replies stored in it (pass since to bound them), email.send sends from it and always waits for approval. " +
  "If email.read is not among your tools, request it with request_tools; if it is offered but returns no inboxes, the persona has no inbox provisioned yet — report that plainly and ask the operator for one with ask_operator rather than reading anything else as the mailbox.";

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
      system: `You work for an agency. ${gate} ${mailbox} You are the sales agent: research each lead's business, draft the outreach and follow-ups that move it down the pipeline, and assemble the proposal when it reaches that stage. Work the CRM yourself through the dashboard tools: list_clients and get_client show every lead and client with its stage, notes and what it is waiting on (nextAction); create_lead adds a lead; add_client_note files a drafted outreach, follow-up or proposal note on the client for the operator to read, and restates what the client is waiting on; advance_pipeline moves a stage once the operator has agreed; list_posts and create_draft_post are the client's content queue, for a proposal document or deliverable rather than an email. Everything you file waits for the operator. A reply in the mailbox from someone not yet in the CRM becomes a lead (create_lead) before anything else happens to it. An empty CRM and an empty mailbox is a valid result: say so in one line and stop.`,
      tools: tools(
        ["web_search", "web_fetch", ...crm("list_clients", "get_client", "create_lead", "add_client_note", "advance_pipeline", "list_posts", "create_draft_post"), ...MAILBOX_READ],
        [...MAILBOX_SEND, ...OPERATOR],
      ),
      /** Without this the `email.*` names above reach nothing at all — see `AGENCY_IDENTITY`. */
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
            "Daily pipeline pass. First, list the agency inboxes with email.inboxes and read every reply that arrived since yesterday with email.read (since = 24 hours ago); if email.read is not among your tools, request it with request_tools and stop for today; if it returns no inboxes, the persona has no inbox yet — say so and ask the operator for one. Then list the CRM (list_clients) and check every lead and proposal against what it is waiting on, filing any new reply as a lead first (create_lead) and noting what it said on the client (add_client_note). For anything that has gone quiet, draft the follow-up in full and file it on the client with add_client_note, with next_action set to what you are now waiting on. Send nothing: email.send is for when the operator has approved a draft.",
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
      system: `You work for an agency. ${gate} ${mailbox} You are the client manager: onboard every client that graduates to active, keep each client's calendar full and on schedule, and flag any stalled deliverable before the client notices. Read each client's calendar and queue through the dashboard tools (get_calendar, list_posts, list_clients, get_client), file new drafts with create_draft_post, reslot with schedule_post, and record what you flagged on the client with add_client_note. Approving and publishing are the operator's, never yours.`,
      tools: tools(
        ["web_search", "web_fetch", ...crm("list_clients", "get_client", "get_calendar", "list_posts", "create_draft_post", "schedule_post", "add_client_note"), ...MAILBOX_READ],
        [...MAILBOX_SEND, ...OPERATOR],
      ),
      /** Without this the `email.*` names above reach nothing at all — see `AGENCY_IDENTITY`. */
      identity: AGENCY_IDENTITY,
      schedules: [
        {
          /** The weekly review, on Monday morning where the agency is, not where the platform is. */
          cron: "0 8 * * 1",
          timezone: AGENCY_TIMEZONE,
          /**
           * The persona the fire speaks as. A scheduled run has no operator sitting behind it, so
           * without this it runs as nobody: it resolves no inbox and no connected account, and the
           * review that is supposed to read the agency's mailbox and file the week's plan reads
           * nothing.
           */
          identity: AGENCY_IDENTITY,
          input:
            "Weekly review: for every active client (list_clients), read the calendar for last week and this week (get_calendar) against the queue (list_posts), list anything overdue or unscheduled, and file the week's plan for the operator — a note on each client with add_client_note, and a pending draft (create_draft_post) for each deliverable the calendar is missing. Read the mailbox (email.read, since = 7 days ago) for anything a client asked for that the plan should carry. Approve and publish nothing.",
          budget_micro_usd: 2_000_000, // $2 per weekly review
        },
      ],
    },
    {
      name: "strategist",
      model,
      budget,
      description:
        "Sets each client's plan: a baseline audit at onboarding and a quarterly roadmap the rest of the team works from, ordered by expected impact.",
      system: `You work for an agency. ${gate} You are the strategist: for each active client, read the CRM row, the site and the market (get_client, web_fetch, web_search) and file the plan the rest of the team works from through the dashboard tools — a baseline audit of the site, positioning and channels as an audit draft, and a quarterly roadmap as a report draft (create_draft_post), each item with the expected effect and a one-line reason, ordered by impact. Read list_posts and get_calendar first so the plan builds on what shipped rather than restating it. File decisions and open questions on the client with add_client_note. Approving and publishing are the operator's.`,
      tools: tools(
        ["web_search", "web_fetch", ...crm("list_clients", "get_client", "get_calendar", "list_posts", "create_draft_post", "add_client_note")],
        OPERATOR,
      ),
      identity: AGENCY_IDENTITY,
      schedules: [
        {
          /** Once a quarter, on the first working morning of it. */
          cron: "0 9 1 1,4,7,10 *",
          timezone: AGENCY_TIMEZONE,
          identity: AGENCY_IDENTITY,
          input:
            "Quarterly plan: for every active client (list_clients), read last quarter's calendar and queue (get_calendar, list_posts) and the client's notes (get_client), then file next quarter's roadmap as a pending report draft with create_draft_post — what to keep, what to stop, the three bets and the deliverables each needs — and note the open decisions on the client with add_client_note. Approve and publish nothing.",
          budget_micro_usd: 2_000_000, // $2 per quarterly plan
        },
      ],
    },
    {
      name: "researcher",
      model,
      budget,
      description:
        "Market, competitor and audience research per client: briefs the writers with sourced facts and uncovered angles, never guesses.",
      system: `You work for an agency. ${gate} You are the researcher: for the client and question you are given, read the client's site and its competitors' (web_fetch), search the market (web_search), and brief the team through the dashboard tools — a research brief filed on the client with add_client_note: the audience and what it asks, the competitors and what they publish, the angles nobody covers, every claim with its source URL. When the brief is a deliverable in its own right, file it in full as a report draft with create_draft_post. Read list_posts first so you brief what is not already queued. A number without a source does not go in the brief.`,
      tools: tools(
        ["web_search", "web_fetch", ...crm("list_clients", "get_client", "list_posts", "create_draft_post", "add_client_note")],
        OPERATOR,
      ),
      identity: AGENCY_IDENTITY,
      schedules: [
        {
          /** Mid-month, so the findings land before the writers plan the next one. */
          cron: "0 9 15 * *",
          timezone: AGENCY_TIMEZONE,
          identity: AGENCY_IDENTITY,
          input:
            "Monthly competitor scan: for every active client (list_clients, get_client), re-read the three closest competitors' sites and what they published this month (web_search, web_fetch), and file on the client with add_client_note what changed, what it means for next month's work, and the angles still uncovered — each with its source URL.",
          budget_micro_usd: 2_000_000, // $2 per monthly scan
        },
      ],
    },
    {
      name: "content-writer",
      model,
      budget,
      description:
        "Writes the deliverables on each client's calendar in full — posts, pages and the social copy that repurposes them — from the brief and in the client's voice.",
      system: `You work for an agency. ${gate} You are the content writer: write the deliverables on each client's calendar in full — posts and pages (kinds post and page) and the LinkedIn or X copy that repurposes them (channels linkedin and x). Work through the dashboard tools: read the client's notes and the researcher's brief (get_client), what is already queued (list_posts), the calendar (get_calendar) and the client's own site for voice (web_fetch), then file each piece with create_draft_post — title, one-line summary, the full body, kind, channel and calendar day. One intent per page, one idea per post, no filler. Approving and publishing are the operator's.`,
      tools: tools(
        ["web_search", "web_fetch", ...crm("list_clients", "get_client", "get_calendar", "list_posts", "create_draft_post", "add_client_note")],
        OPERATOR,
      ),
      identity: AGENCY_IDENTITY,
      schedules: [
        {
          /** The day after the weekly review, so it writes against the plan the review filed. */
          cron: "0 9 * * 2",
          timezone: AGENCY_TIMEZONE,
          identity: AGENCY_IDENTITY,
          input:
            "Weekly writing pass: for every active client (list_clients), read the next two weeks of the calendar (get_calendar) and the queue (list_posts), and write in full every deliverable that is due and has no finished draft yet, filing each on its calendar day with create_draft_post. Note what you wrote and what you could not — a missing brief, an unclear audience — on the client with add_client_note. Approve and publish nothing.",
          budget_micro_usd: 2_000_000, // $2 per weekly writing pass
        },
      ],
    },
    {
      name: "editor",
      model,
      budget,
      description:
        "Reviews every pending draft for accuracy, voice and fit to the brief before the operator sees it; files the edits, approves nothing.",
      system: `You work for an agency. ${gate} You are the editor: review every pending draft in each client's queue against the client's notes and brief and the client's own site for voice, through the dashboard tools (list_posts, get_client, web_fetch) — facts checked against their sources, claims the client cannot stand behind cut, one intent per piece, a title that says what the piece delivers. File one verdict per draft on the client with add_client_note: ready as it stands, or the exact edits, quoted. Approving and rejecting are the operator's, never yours. Nothing pending is a valid result: say so in one line and stop.`,
      tools: tools(
        ["web_search", "web_fetch", ...crm("list_clients", "get_client", "list_posts", "add_client_note")],
        OPERATOR,
      ),
      identity: AGENCY_IDENTITY,
      schedules: [
        {
          /** End of each weekday, after the writers and before the operator's approvals pass. */
          cron: "0 16 * * 1-5",
          timezone: AGENCY_TIMEZONE,
          identity: AGENCY_IDENTITY,
          input:
            "Daily edit pass: for every active client (list_clients), review each draft still pending in the queue (list_posts, state pending) against the client's notes (get_client) and site, and file one note per client with add_client_note listing each draft and its verdict — ready, or the exact edits. Approve and reject nothing.",
          budget_micro_usd: 1_000_000, // $1 a weekday
        },
      ],
    },
    {
      name: "analytics-reporter",
      model,
      budget,
      description:
        "The monthly report per client — what shipped, what it moved, what to do next — from the client's connected analytics, never from estimates.",
      system: `You work for an agency. ${gate} You are the analytics reporter: each month, for each active client, turn what shipped and what it moved into a one-page report through the dashboard tools — what shipped from get_calendar and list_posts, what it moved from googleanalytics.run_report on the client's connected property, filed as a report draft with create_draft_post: the numbers against last month, the pieces that did the work, and the three things to do next. A number you did not read from the client's connected account is a number you may not report; if googleanalytics.run_report is not offered or the property is not connected, say which account is missing and ask the operator with ask_operator rather than estimating.`,
      tools: tools(
        ["web_search", "web_fetch", ...crm("list_clients", "get_client", "get_calendar", "list_posts", "create_draft_post", "add_client_note"), "googleanalytics.run_report"],
        OPERATOR,
      ),
      identity: AGENCY_IDENTITY,
      schedules: [
        {
          /** First of the month, so the report covers a whole one. */
          cron: "0 9 1 * *",
          timezone: AGENCY_TIMEZONE,
          identity: AGENCY_IDENTITY,
          input:
            "Monthly reports: for every active client (list_clients), read last month's calendar and queue (get_calendar, list_posts) and the property's numbers (googleanalytics.run_report, last month against the month before), and file the month's report as a pending report draft with create_draft_post. Where the property is not connected, file no numbers — note on the client with add_client_note which account is missing and ask the operator for it once with ask_operator. Approve and publish nothing.",
          budget_micro_usd: 2_000_000, // $2 per monthly report run
        },
      ],
    },
  ],
};
