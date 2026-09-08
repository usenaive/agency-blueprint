/**
 * `seo-geo` — the same agency, specialised in search: technical audits, SERP work and
 * answer-engine optimization, with a three-agent crew provisioned per client.
 *
 * It is a **delta on `blank`**, and deliberately reads as one. The pair of agency agents is
 * `blank`'s, with the focus added to each prompt and the words of each fire made the specialism's;
 * the machinery around them — model, budget, deny-by-default toolset, approval gate, the crons
 * themselves — is shared, so what this file shows is exactly what the specialism changes: the
 * words, the kinds of work, the crew, and the demo seed.
 *
 * Switching to it widens: `naive up` creates nothing the operator loses, and the crew below is
 * created per client at onboarding by `server/proxy.ts`. Switching away leaves every crew agent
 * standing and reports it — an agent is deleted only by an explicit `removed:` tombstone.
 */
import type { AgentDecl } from "@usenaive-sdk/blueprints";
import type { Client } from "../seed/clients.ts";
import type { Post } from "../seed/posts.ts";
import { AGENCY_IDENTITY, blank, budget, crm, gate, model, OPERATOR, tools, type AgencyTemplate } from "./blank.ts";
import { VOCABULARY } from "./index.ts";

/** What each shared agent additionally does when the agency's specialism is search. */
const FOCUS: Record<string, string> = {
  sales:
    "This agency sells search and answer-engine work, so research each lead's search presence before you write a word: what they rank for, whether AI answers cite them or a competitor, and what a first technical audit would find. Lead every outreach with one specific finding about their site. A proposal here is a scoped plan — audit first, then a monthly article and landing-page count, answer blocks, and a monthly ranking and citation report.",
  "client-manager":
    "The deliverables here are keyword research, articles, landing pages, answer blocks, technical audits and SERP reports (kinds article, landing-page, answer-block, audit, serp-report). Keep each client's calendar full of them and each client's crew pointed at the next one: a draft you file is the brief, and its summary names the crew member that writes the piece — seo-writer for keyword maps, articles and landing copy, geo-optimizer for answer blocks and citation work, audit-runner for audits and SERP reports — each suffixed with the client's slug, so the operator knows which agent to start.",
};

/**
 * The words of each shared fire when the agency's specialism is search. The cron is `blank`'s —
 * `naive up` matches live rows by exact cron text, so a specialism must never re-spell one — and so
 * are the budget, the zone and the persona; only what the fire is told to do is this template's.
 */
const FIRES: Record<string, Record<string, string>> = {
  sales: {
    "30 8 * * 1-5":
      "Daily pipeline pass for a search agency. First, list the agency inboxes with email.inboxes and read every reply that arrived since yesterday with email.read (since = 24 hours ago); if email.read is not among your tools, request it with request_tools and stop for today; if it returns no inboxes, the persona has no inbox yet — say so and ask the operator for one. Then list the CRM (list_clients) and check every lead and proposal against what it is waiting on, filing any new reply as a lead first (create_lead). For every new lead, research their search presence before anything else: search their brand and their three most obvious commercial terms, note what they rank for, whether AI answers cite them or a competitor, and what a first technical audit would likely find, and file that as a note on the lead (add_client_note). For anything that has gone quiet, draft the follow-up in full — lead with one specific finding about their site — and file it with add_client_note, with next_action set to what you are now waiting on. When a lead has reached proposal, the proposal is a scoped plan: audit first, a monthly article and landing-page count, answer blocks for the questions AI engines answer without them, and a monthly ranking and citation report; file it with create_draft_post. Send nothing: email.send is for when the operator has approved a draft.",
  },
  "client-manager": {
    "0 8 * * 1":
      "Weekly search review. For every active client (list_clients, get_client), read the calendar for last week and this week (get_calendar) against the queue (list_posts) and list anything overdue or unscheduled. Then file the week's plan for the operator: a note on each client with add_client_note, and a pending draft (create_draft_post) for each deliverable the calendar is missing — the keyword research for the client's next topic cluster (a keyword and topic map, filed as an audit), the blog articles written against that map (kind article), a landing page for one query and one intent (kind landing-page), answer blocks for the questions AI engines are answering without the client (kind answer-block), and the month's technical audit and SERP report (kinds audit and serp-report) if this month's is not queued. Each draft is the brief for the piece — the target query, the intent, what already ranks or is cited, and what the piece must cover — and its summary names the client's crew member that writes it (seo-writer, geo-optimizer or audit-runner, suffixed with the client's slug), so the operator knows which agent to start. Read the mailbox (email.read, since = 7 days ago) for anything a client asked for that the plan should carry. Approve and publish nothing.",
  },
};

/** What each shared agent is for, said the way this specialism would say it. */
const DESCRIPTION: Record<string, string> = {
  sales:
    "Works the CRM pipeline for a search agency: researches each lead's rankings and AI-answer citations, drafts outreach and follow-ups led by a finding, scopes proposals as audit, articles, landing pages, answer blocks and reports. Never sends anything without operator approval.",
  "client-manager":
    "Onboards clients that graduate to active, and every Monday files the week's keyword research, articles, landing pages, answer blocks, audits and SERP reports as pending briefs, each naming the crew member that writes it.",
};

/** The gate again, for an agent that works inside one client's account rather than the agency's. */
const clientGate =
  `You work for an SEO/GEO agency on one client's account. ${gate} ` +
  "The client is the CRM row your name ends in (list_clients, get_client); file every deliverable as a pending draft on that client with create_draft_post, in full, and read list_posts first so you do not file what is already queued. " +
  "The client's own Search Console and Analytics reach you only once the operator has connected them; if none of the search tools you were granted is offered this turn, say which account is missing and ask the operator to connect it with ask_operator rather than estimating a number.";

/**
 * What a search crew reads on the client's *own* connected accounts, named the way a connection
 * reaches a turn (`<connector>.<tool>`). A policy row does not create the account: the tool exists
 * in a turn only once the operator has connected the property to `AGENCY_IDENTITY`. Every one is a
 * read, so every one is `allow`: this crew works inside one client's property and changes nothing
 * there. Without these names an SEO crew connected to a client's search account still sees only
 * `web_search` and `web_fetch` — the client's own numbers stay out of reach. Each member also
 * carries both operator doors (`OPERATOR`): `ask_operator` for the account not yet connected, and
 * `request_tools` for a tool the task turns out to need that this list does not name.
 */
const SEARCH_READ = [
  "googlesearchconsole.query_search_analytics",
  "googlesearchconsole.list_sites",
  "googlesearchconsole.inspect_url",
  "googleanalytics.run_report",
];

/**
 * The per-client crew. `server/proxy.ts` appends the client slug to each name at onboarding
 * (`seo-writer--acme-dental`), which is how one organization hosts many clients' agents. Model,
 * budget, allow-list and persona are template data — the server holds none of them.
 *
 * Every member names `AGENCY_IDENTITY` for the reason the agency's own pair does: without a persona
 * the search and analytics names above resolve to nothing, and a crew sold on working against the
 * client's own numbers can call `web_search` and `web_fetch` and no more. `POST /v1/agents` carries
 * no identity field, so the grant is a second call — `server/proxy.ts` makes it, and reports the
 * member `failed` when it does not land rather than leaving an agent running as nobody behind a
 * toolset that says otherwise.
 */
const crew: AgentDecl[] = [
  {
    name: "seo-writer",
    model,
    budget,
    description: "Briefs, articles and landing copy from the client's keywords and site.",
    system: `${clientGate} You are the SEO writer: turn the client's keywords and site into briefs, articles and landing copy that can rank (kinds article and landing-page). Start from what the client already ranks for (googlesearchconsole.query_search_analytics) rather than from a guess.`,
    tools: tools(
      ["web_search", "web_fetch", ...crm("list_clients", "get_client", "list_posts", "create_draft_post"), "googlesearchconsole.query_search_analytics"],
      OPERATOR,
    ),
    identity: AGENCY_IDENTITY,
  },
  {
    name: "geo-optimizer",
    model,
    budget,
    description: "Content tuned for AI-engine citations: schema, entity coverage, answer blocks, llms.txt.",
    system: `${clientGate} You are the GEO optimizer: tune the client's content for AI-engine citations — schema, entity coverage, answer blocks, llms.txt — and file each as an answer-block draft or a revision brief. Search the query yourself and read what IS being cited; the gap is the brief.`,
    tools: tools(
      ["web_search", "web_fetch", ...crm("list_clients", "get_client", "list_posts", "create_draft_post"), "googlesearchconsole.query_search_analytics", "googlesearchconsole.inspect_url"],
      OPERATOR,
    ),
    identity: AGENCY_IDENTITY,
  },
  {
    name: "audit-runner",
    model,
    budget,
    description: "Recurring technical and content audits of the client's site and rankings.",
    system: `${clientGate} You are the audit runner: run recurring technical and content audits of the client's site and rankings against the client's own connected search and analytics accounts, and file the findings as an audit or serp-report draft. A number you did not read from the client's account is a number you may not report; say plainly which property was missing.`,
    tools: tools(
      ["web_search", "web_fetch", ...crm("list_clients", "get_client", "list_posts", "create_draft_post"), ...SEARCH_READ],
      OPERATOR,
    ),
    identity: AGENCY_IDENTITY,
  },
];

const clients: Client[] = [
  {
    id: "cli_ac01", slug: "acme-dental", name: "Acme Dental", domain: "acmedental.example", stage: "active",
    services: ["SEO", "GEO", "Content"],
    contact: { name: "Sample Contact", email: "contact@acmedental.example", role: "Owner" },
    notes: ["Demo row — wants to rank for 'invisalign boston' by Q3.", "Approved the pillar-page plan on the last call."],
    nextAction: "Send March content calendar for sign-off",
  },
  {
    id: "cli_no02", slug: "northbeam", name: "Northbeam Legal", domain: "northbeam.example", stage: "active",
    services: ["SEO", "Content"],
    contact: { name: "Sample Contact", email: "contact@northbeam.example", role: "Managing partner" },
    notes: ["Demo row — practice-area pages are thin; the audit flagged 14 of 22."],
    nextAction: "Review audit-runner findings together (Thu)",
  },
  {
    id: "cli_ve03", slug: "verdant", name: "Verdant Skincare", domain: "verdant.example", stage: "active",
    services: ["GEO", "Content"],
    contact: { name: "Sample Contact", email: "contact@verdant.example", role: "Head of growth" },
    notes: ["Demo row — wants AI-engine citations for 'retinol alternatives'.", "llms.txt shipped last sprint."],
    nextAction: "Share the first citation report",
  },
  {
    id: "cli_ha04", slug: "harbor", name: "Harbor Fintech", domain: "harbor.example", stage: "proposal",
    services: ["SEO", "GEO"],
    contact: { name: "Sample Contact", email: "contact@harbor.example", role: "CMO" },
    notes: ["Demo row — proposal sent: 12 articles a month plus audits."],
    nextAction: "Follow up on the proposal (no reply in 5 days)",
  },
  {
    id: "cli_su05", slug: "summit", name: "Summit Outdoor Co", domain: "summitoutdoor.example", stage: "lead",
    services: ["SEO"],
    contact: { name: "Sample Contact", email: "contact@summitoutdoor.example", role: "Founder" },
    notes: ["Demo row — inbound from the site's contact form; wants a technical audit first."],
    nextAction: "Book discovery call",
  },
  {
    id: "cli_or07", slug: "orchard", name: "Orchard Realty", domain: "orchardrealty.example", stage: "churned",
    services: ["SEO"],
    contact: { name: "Sample Contact", email: "contact@orchardrealty.example", role: "Broker" },
    notes: ["Demo row — paused after four months. Re-approach in the fall."],
  },
];

const posts: Post[] = [
  { id: "post_a101", clientId: "cli_ac01", title: "Invisalign vs braces: the honest cost breakdown", summary: "Demo row — pillar article targeting 'invisalign boston cost', with FAQ schema.", kind: "article", channel: "blog", status: "pending", agent: "seo-writer--acme-dental", scheduledFor: "2025-03-04", hue: 210 },
  { id: "post_a102", clientId: "cli_ac01", title: "Emergency dentist landing page", summary: "Demo row — location page with LocalBusiness schema and a same-day booking CTA.", kind: "landing-page", channel: "blog", status: "ready", agent: "seo-writer--acme-dental", scheduledFor: "2025-03-07", hue: 160 },
  { id: "post_a103", clientId: "cli_ac01", title: "Answer block: 'does whitening damage enamel?'", summary: "Demo row — entity-dense answer block tuned for AI-engine citation.", kind: "answer-block", channel: "blog", status: "approved", agent: "geo-optimizer--acme-dental", scheduledFor: "2025-03-12", hue: 280 },
  { id: "post_a104", clientId: "cli_ac01", title: "March technical audit", summary: "Demo row — crawl and Core Web Vitals sweep.", kind: "audit", channel: "blog", status: "posted", agent: "audit-runner--acme-dental", scheduledFor: "2025-03-01", postedAt: "2d ago", clicks: 312, impressions: 9_840, hue: 30 },
  { id: "post_n201", clientId: "cli_no02", title: "What to do after a rear-end collision in MA", summary: "Demo row — practice-area article from a competitor gap in the last audit.", kind: "article", channel: "blog", status: "pending", agent: "seo-writer--northbeam", scheduledFor: "2025-03-05", hue: 340 },
  { id: "post_n202", clientId: "cli_no02", title: "Practice-area rankings, February", summary: "Demo row — where the 22 practice pages sit, and against whom.", kind: "serp-report", channel: "blog", status: "approved", agent: "audit-runner--northbeam", scheduledFor: "2025-03-14", hue: 120 },
  { id: "post_n203", clientId: "cli_no02", title: "Thin practice-area pages: fix plan", summary: "Demo row — audit follow-up covering the 14 flagged pages, ordered by traffic.", kind: "audit", channel: "blog", status: "posted", agent: "audit-runner--northbeam", scheduledFor: "2025-03-03", postedAt: "4d ago", clicks: 88, impressions: 2_310, hue: 200 },
  { id: "post_n204", clientId: "cli_no02", title: "LinkedIn: 'the 5-minute will myth'", summary: "Demo row — repurposed from the estate-planning piece.", kind: "article", channel: "linkedin", status: "rejected", agent: "seo-writer--northbeam", scheduledFor: "2025-03-10", rejectedReason: "Demo row — rejected so you can see what that looks like.", hue: 0 },
  { id: "post_v301", clientId: "cli_ve03", title: "Retinol alternatives, ranked by evidence", summary: "Demo row — answer blocks, cited studies, entity coverage for eight actives.", kind: "article", channel: "blog", status: "ready", agent: "geo-optimizer--verdant", scheduledFor: "2025-03-06", hue: 60 },
  { id: "post_v302", clientId: "cli_ve03", title: "Answer block: 'is bakuchiol safe in pregnancy?'", summary: "Demo row — high-intent question with no authoritative answer indexed.", kind: "answer-block", channel: "blog", status: "pending", agent: "geo-optimizer--verdant", scheduledFor: "2025-03-11", hue: 250 },
  { id: "post_v303", clientId: "cli_ve03", title: "X thread: how AI engines cite skincare claims", summary: "Demo row — founder-voice thread linking the flagship article.", kind: "article", channel: "x", status: "approved", agent: "geo-optimizer--verdant", scheduledFor: "2025-03-18", hue: 300 },
  { id: "post_v304", clientId: "cli_ve03", title: "February citation report", summary: "Demo row — where Verdant shows up in AI answers against the top three competitors.", kind: "serp-report", channel: "blog", status: "posted", agent: "audit-runner--verdant", scheduledFor: "2025-03-02", postedAt: "5d ago", clicks: 54, impressions: 1_120, hue: 180 },
];

export const seoGeo: AgencyTemplate = {
  ...blank,
  name: "seo-geo",
  description: VOCABULARY["seo-geo"].description,
  kinds: VOCABULARY["seo-geo"].kinds,
  words: { ...VOCABULARY["seo-geo"].words },
  seed: { clients, posts },
  crew,
  // The pair is shared; its focus, its description and the words of its fires are this template's.
  // Every other field of the agent — model, budget, allow-list, persona, the crons — stays `blank`'s,
  // so a change there reaches both templates.
  agents: blank.agents.map((agent) => ({
    ...agent,
    description: DESCRIPTION[agent.name] ?? agent.description,
    system: `${agent.system} ${FOCUS[agent.name] ?? ""}`.trim(),
    schedules: agent.schedules?.map((schedule) => ({ ...schedule, input: FIRES[agent.name]?.[schedule.cron] ?? schedule.input })),
  })),
};
