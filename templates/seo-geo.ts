/**
 * `seo-geo` — the same agency, specialised in search: technical audits, SERP work and
 * answer-engine optimization, with three search specialists on the agency team and a three-agent
 * crew provisioned per client.
 *
 * It is a **delta on `blank`**, and deliberately reads as one. `blank`'s seven agency agents are
 * kept, with one sentence of focus added to each (and the search reads the reporter needs); the
 * machinery around them — model, budget, deny-by-default toolset, approval gate — is shared, so
 * what this file shows is exactly what the specialism changes: the words, the kinds of work, the
 * specialists it adds, the crew, and the demo seed.
 *
 * Switching to it widens: `naive up` creates nothing the operator loses, and the crew below is
 * created per client at onboarding by `server/proxy.ts`. Switching away leaves every crew agent
 * standing and reports it — an agent is deleted only by an explicit `removed:` tombstone.
 */
import type { AgentDecl } from "@usenaive-sdk/blueprints";
import type { Client } from "../seed/clients.ts";
import type { Post } from "../seed/posts.ts";
import {
  AGENCY_IDENTITY,
  AGENCY_TIMEZONE,
  blank,
  budget,
  crm,
  gate,
  mailbox,
  MAILBOX_READ,
  MAILBOX_SEND,
  model,
  OPERATOR,
  tools,
  type AgencyTemplate,
} from "./blank.ts";
import { VOCABULARY } from "./index.ts";

/** What each shared agent additionally does when the agency's specialism is search. */
const FOCUS: Record<string, string> = {
  sales:
    "This agency sells search and answer-engine work, so research each lead's search presence first — what they rank for, where they are cited in AI answers, and what a first audit would find.",
  "client-manager":
    "The deliverables here are audits, articles, landing pages, answer blocks and SERP reports; keep each client's calendar full of them and each client's crew pointed at the next one.",
  strategist:
    "The plan here is a search plan: which keyword clusters and AI-answer questions the quarter targets, which page carries each, and the technical fixes that gate them; the baseline audit is crawlability, indexing and where the client ranks today.",
  researcher:
    "Research here is competitor search presence: who ranks and who is cited in AI answers for the client's questions, what those pages do that the client's do not, and which questions have no authoritative answer indexed.",
  "content-writer":
    "Content here is search content — articles and landing pages (kinds article and landing-page) written to the keyword researcher's cluster map: one primary query per piece, answered in the first paragraph, headings that match how people search, internal links to the client's related pages.",
  editor:
    "Check every draft against its target query as well as its brief: the query in the title and first paragraph, headings that match its intent, entities and sources an AI engine can cite, and no claim the client's site cannot back.",
  "analytics-reporter":
    "The monthly report here is a serp-report: clicks, impressions and position by query and page from googlesearchconsole.query_search_analytics beside the Analytics numbers, the ranking moves against last month, and where the client is cited in AI answers.",
};

/**
 * `blank`'s prompts file `blank`'s kinds. The same role here files this template's — a post is an
 * article, a page a landing page, the recurring report a serp-report; an audit is an audit in both.
 * The store does not check a draft's kind against the template, so a prompt left saying `post`
 * would file a post into a queue whose screens have no such kind.
 */
const REKIND: [RegExp, string][] = [
  [/\bkinds post and page\b/g, "kinds article and landing-page"],
  [/\bposts and pages\b/g, "articles and landing pages"],
  [/\breport draft\b/g, "serp-report draft"],
];
export const rekind = <T extends string | undefined>(text: T): T =>
  (text === undefined ? text : REKIND.reduce<string>((s, [from, to]) => s.replace(from, to), text)) as T;

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
 * Search reads a shared agent gains here. The reporter's month is Search Console as much as
 * Analytics, and a name not on its allow-list is a number it cannot read.
 */
const WIDEN: Record<string, string[]> = {
  "analytics-reporter": ["googlesearchconsole.query_search_analytics", "googlesearchconsole.list_sites"],
};

const widen = (agent: AgentDecl): AgentDecl["tools"] => {
  const extra = WIDEN[agent.name];
  if (extra === undefined || agent.tools === undefined) return agent.tools;
  return { ...agent.tools, configs: { ...agent.tools.configs, ...tools(extra)?.configs } };
};

/**
 * The specialists the agency itself runs, across every client. They are `agents` — static names,
 * provisioned by `naive up`, published on the artifact the dashboard's template card reads — where
 * the crew below is per client and reaches the dashboard only through onboarding.
 */
const specialists: AgentDecl[] = [
  {
    name: "keyword-researcher",
    model,
    budget,
    description: "Keyword and question research per client: clusters by intent, ranks by opportunity, hands the writers a map.",
    system: `You work for an SEO/GEO agency. ${gate} You are the keyword researcher: build and maintain the keyword map each client's writers work from, through the dashboard tools. Read what the client already ranks for and what sits on page two (googlesearchconsole.query_search_analytics), the queries competitors rank for that the client does not (web_search, web_fetch), and the questions people put to AI engines about the client's category. Cluster by intent, one target page per cluster, ranked by opportunity — demand against how far the client is from ranking — and file the map as a serp-report draft with create_draft_post and the changes since last time on the client with add_client_note. Read list_posts first so no cluster is briefed twice. Search Console reaches you only once the operator has connected the client's property; if it is not offered, say so and ask with ask_operator rather than guessing demand.`,
    tools: tools(
      ["web_search", "web_fetch", ...crm("list_clients", "get_client", "list_posts", "create_draft_post", "add_client_note"), "googlesearchconsole.query_search_analytics", "googlesearchconsole.list_sites"],
      OPERATOR,
    ),
    identity: AGENCY_IDENTITY,
    schedules: [
      {
        /** After the Monday review, before Tuesday's writing pass. */
        cron: "30 9 * * 1",
        timezone: AGENCY_TIMEZONE,
        identity: AGENCY_IDENTITY,
        input:
          "Weekly keyword pass: for every active client (list_clients), pull the last 28 days of queries by page (googlesearchconsole.query_search_analytics), list the queries at positions 5–20 that a rewrite or a new page could move and any new questions in the category, and file the changes to the map on the client with add_client_note, naming the page each belongs to. Where the property is not connected, say so on the client and move on.",
        budget_micro_usd: 2_000_000, // $2 per weekly pass
      },
    ],
  },
  {
    name: "link-outreach",
    model,
    budget,
    description: "Link building and digital PR: finds prospects worth a link, drafts the pitch, tracks replies — every send waits for approval.",
    system: `You work for an SEO/GEO agency. ${gate} ${mailbox} You are the link and outreach specialist: earn each client links and mentions that move rankings. Find prospects — sites linking to the client's competitors, resource pages, publications covering the client's category (web_search, web_fetch) — qualify each by relevance and whether it actually links out, and draft the pitch: what the client's page adds to theirs, in three sentences, no template. Work through the dashboard tools: file each prospect list and drafted pitch on the client with add_client_note, and note replies read from the mailbox (email.read) there too. email.send waits for the operator; never pitch a site the operator has not seen on a list.`,
    tools: tools(
      ["web_search", "web_fetch", ...crm("list_clients", "get_client", "list_posts", "add_client_note"), ...MAILBOX_READ],
      [...MAILBOX_SEND, ...OPERATOR],
    ),
    identity: AGENCY_IDENTITY,
    schedules: [
      {
        /** Midweek, once the week's content is known and pitchable. */
        cron: "0 9 * * 3",
        timezone: AGENCY_TIMEZONE,
        identity: AGENCY_IDENTITY,
        input:
          "Weekly outreach pass: read replies to earlier pitches (email.read, since = 7 days ago) and note each on its client with add_client_note; if email.read is not among your tools, request it with request_tools and stop for today. Then, for every active client (list_clients), find ten new qualified prospects and draft the pitch for each, filed on the client with add_client_note. Send nothing.",
        budget_micro_usd: 2_000_000, // $2 per weekly pass
      },
    ],
  },
  {
    name: "technical-seo",
    model,
    budget,
    description: "Site health across every client: crawlability, indexing, Core Web Vitals, structured data — files the fixes, ordered by impact.",
    system: `You work for an SEO/GEO agency. ${gate} You are the technical SEO: keep every client's site crawlable, indexed and fast, through the dashboard tools. Check indexing and coverage for the pages that matter (googlesearchconsole.inspect_url, googlesearchconsole.list_sites), read the pages themselves for canonical, robots, structured data, internal links and rendering problems (web_fetch), and file the findings as an audit draft with create_draft_post — each fix with the pages affected, the expected effect and the exact change, ordered by impact. Record anything urgent on the client with add_client_note so the client manager sees it. A verdict on indexing comes from inspect_url, not from a guess; if the property is not connected, say so and ask the operator with ask_operator.`,
    tools: tools(
      ["web_search", "web_fetch", ...crm("list_clients", "get_client", "list_posts", "create_draft_post", "add_client_note"), ...SEARCH_READ],
      OPERATOR,
    ),
    identity: AGENCY_IDENTITY,
    schedules: [
      {
        /** Early Thursday, so a regression found this week is fixed before the client's Monday. */
        cron: "0 7 * * 4",
        timezone: AGENCY_TIMEZONE,
        identity: AGENCY_IDENTITY,
        input:
          "Weekly site check: for every active client (list_clients), inspect the pages that shipped this month (list_posts) and the ten landing pages with the most clicks (googlesearchconsole.query_search_analytics, googlesearchconsole.inspect_url). File an audit draft with create_draft_post only where something is broken, missing or regressed, and a one-line all-clear on the client with add_client_note otherwise. Where the property is not connected, say so on the client and move on.",
        budget_micro_usd: 2_000_000, // $2 per weekly check
      },
    ],
  },
];

/** The gate again, for an agent that works inside one client's account rather than the agency's. */
const clientGate =
  `You work for an SEO/GEO agency on one client's account. ${gate} ` +
  "The client is the CRM row your name ends in (list_clients, get_client); file every deliverable as a pending draft on that client with create_draft_post, in full, and read list_posts first so you do not file what is already queued. " +
  "The client's own Search Console and Analytics reach you only once the operator has connected them; if none of the search tools you were granted is offered this turn, say which account is missing and ask the operator to connect it with ask_operator rather than estimating a number.";


/**
 * The per-client crew. `server/proxy.ts` appends the client slug to each name at onboarding
 * (`seo-writer--acme-dental`), which is how one organization hosts many clients' agents. Model,
 * budget, allow-list and persona are template data — the server holds none of them.
 *
 * Every member names `AGENCY_IDENTITY` for the reason the agency's own team does: without a persona
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
  // The team is shared; only its focus, its kinds and the reporter's search reads are this
  // template's. Every other field of a shared agent — model, budget, schedule — stays `blank`'s, so
  // a change there reaches both templates. The specialists are appended, so a switch only widens.
  agents: [
    ...blank.agents.map((agent) => ({
      ...agent,
      description: rekind(agent.description),
      system: `${rekind(agent.system)} ${FOCUS[agent.name] ?? ""}`.trim(),
      tools: widen(agent),
      schedules: agent.schedules?.map((s) => ({ ...s, input: rekind(s.input) })),
    })),
    ...specialists,
  ],
};
