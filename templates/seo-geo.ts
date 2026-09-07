/**
 * `seo-geo` — the same agency, specialised in search: technical audits, SERP work and
 * answer-engine optimization, with a three-agent crew provisioned per client.
 *
 * It is a **delta on `blank`**, and deliberately reads as one. The pair of agency agents is
 * `blank`'s, with one sentence of focus added to each; the machinery around them — model, budget,
 * deny-by-default toolset, approval gate — is shared, so what this file shows is exactly what the
 * specialism changes: the words, the kinds of work, the crew, and the demo seed.
 *
 * Switching to it widens: `naive up` creates nothing the operator loses, and the crew below is
 * created per client at onboarding by `server/proxy.ts`. Switching away leaves every crew agent
 * standing and reports it — an agent is deleted only by an explicit `removed:` tombstone.
 */
import type { AgentDecl } from "@usenaive-sdk/blueprints";
import type { Client } from "../seed/clients.ts";
import type { Post } from "../seed/posts.ts";
import { AGENCY_IDENTITY, ASK_OPERATOR, blank, budget, crm, gate, model, tools, type AgencyTemplate } from "./blank.ts";
import { VOCABULARY } from "./index.ts";

/** What each shared agent additionally does when the agency's specialism is search. */
const FOCUS: Record<string, string> = {
  sales:
    "This agency sells search and answer-engine work, so research each lead's search presence first — what they rank for, where they are cited in AI answers, and what a first audit would find.",
  "client-manager":
    "The deliverables here are audits, articles, landing pages, answer blocks and SERP reports; keep each client's calendar full of them and each client's crew pointed at the next one.",
};

/** The gate again, for an agent that works inside one client's account rather than the agency's. */
const clientGate = `You work for an SEO/GEO agency on one client's account. ${gate}`;

/**
 * What a search crew reads on the client's *own* connected accounts, named the way a connection
 * reaches a turn (`<connector>.<tool>`; see the `gmail.*` note on `MAILBOX_READ` in `blank.ts` for
 * the rule). Every one is a read, so every one is `allow`: this crew works inside one client's
 * property and changes nothing there. Without these names an SEO crew connected to a client's
 * search account still sees only `web_search` and `web_fetch` — the client's own numbers stay out
 * of reach. Each member also carries `ask_operator`, because the gate tells it to ask for what it
 * is missing — an account not yet connected, most often — and a rule that names a tool the agent
 * does not hold is a rule the agent cannot follow.
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
    system: `${clientGate} You are the SEO writer: turn the client's keywords and site into briefs, articles and landing copy that can rank. Start from what the client already ranks for rather than from a guess.`,
    tools: tools(["web_search", "web_fetch", "googlesearchconsole.query_search_analytics"], ASK_OPERATOR),
    identity: AGENCY_IDENTITY,
  },
  {
    name: "geo-optimizer",
    model,
    budget,
    description: "Content tuned for AI-engine citations: schema, entity coverage, answer blocks, llms.txt.",
    system: `${clientGate} You are the GEO optimizer: tune the client's content for AI-engine citations — schema, entity coverage, answer blocks, llms.txt.`,
    tools: tools(["web_search", "web_fetch", "googlesearchconsole.query_search_analytics"], ASK_OPERATOR),
    identity: AGENCY_IDENTITY,
  },
  {
    name: "audit-runner",
    model,
    budget,
    description: "Recurring technical and content audits of the client's site and rankings.",
    system: `${clientGate} You are the audit runner: run recurring technical and content audits of the client's site and rankings against the client's own connected search and analytics accounts, and file the findings.`,
    tools: tools(["web_search", "web_fetch", ...crm("list_clients", "get_client", "create_draft_post"), ...SEARCH_READ], ASK_OPERATOR),
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
  // The pair is shared; only its focus is this template's. Every other field of the agent — model,
  // budget, allow-list, schedule — stays `blank`'s, so a change there reaches both templates.
  agents: blank.agents.map((agent) => ({ ...agent, system: `${agent.system} ${FOCUS[agent.name] ?? ""}`.trim() })),
};
