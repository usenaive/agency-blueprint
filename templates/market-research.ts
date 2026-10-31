/**
 * `market-research` — the same agency, specialised in decision-ready research: market sizing,
 * competitor teardowns and voice-of-customer reports, with a three-agent crew provisioned per client.
 *
 * Like `seo-geo` it is a **delta on `blank`**: the seven keep their model, budget, timers, intakes
 * and allow-lists, and this file adds only a focus, research skills and sales work (`specialise`).
 * What the specialism changes is here: the words, the kinds of work, the fourth question, the crew
 * and the demo seed.
 *
 * The one promise this agency sells is that no number appears without its source, so every prompt
 * below — the seven's focus and the crew's gate — says so, and the crew reads public data through the
 * platform's priced data catalogue (`data_search`, `data_describe`, `data_run`) rather than guessing.
 */
import type { AgentDecl } from "@usenaive-sdk/blueprints";
import type { Client } from "../seed/clients.ts";
import type { Post } from "../seed/posts.ts";
import { AGENCY_IDENTITY, blank, budget, crm, gate, HANDOFF, model, OPERATOR, questions, specialise, tools, type AgencyTemplate } from "./blank.ts";
import { VOCABULARY } from "./index.ts";

/** The sourcing rule every research seat repeats, because it is the product. */
const SOURCED =
  "Every figure carries the URL it came from and the date you read it; an estimate says it is one and shows its method; a quote is verbatim and linked. Never invent a number, a respondent or a quote.";

const FOCUS: Record<string, string> = {
  "site-builder":
    "This agency sells research: the services section names market sizing, competitor teardowns and customer insight; the FAQ explains how every figure is sourced and what the agency will not estimate.",
  sales:
    "This agency sells research: open each lead with one sourced fact about its own market, and file the source with the note.",
  "client-manager":
    "The deliverables here are market sizings, competitor teardowns, voice-of-customer reports and trend briefs; keep each client's calendar full of them and each client's team pointed at the next one.",
  "content-writer":
    "Write each post around one question a buyer of research asks, filed as kind article; every figure links its source.",
  "content-reviser":
    "Weak here means: a figure with no source, a source that no longer loads, or a claim the post never supports.",
  "gap-researcher":
    "Compare the agency against rival research firms and consultancies: the questions they publish answers to, the reports they sell, and what they show as method.",
  "proposal-writer":
    "Tiers are scoped in reports per quarter — sizings, teardowns, customer-insight reports — and a proposal never promises a finding before the research is done.",
};

const SKILLS: Record<string, string[]> = {
  sales: ["naive/research-sourcing"],
  "content-writer": ["naive/research-sourcing"],
  "gap-researcher": ["naive/competitor-teardown"],
};

const WORK: Record<string, string> = {
  sales:
    "In this agency every cold opener (not the personal notes to people the operator knows) quotes one sourced fact about the prospect's own market — its size, growth, or a shift its buyers are making — found with web_search and read with web_fetch. " +
    "File the fact and its URL as a note on the lead with add_client_note before drafting. Public pages only, and no figure you did not read yourself.",
};

/** The gate for an agent that works inside one client's account rather than the agency's. */
const clientGate =
  `You work for a market research agency on one client's account. ${gate} ` +
  "The client is the CRM row your name ends in (list_clients, get_client); read its notes for the question the client is paying to answer. File every deliverable as a pending draft on that client with create_draft_post, in full, and read list_posts first so you do not file what is already queued. " +
  "For public data, data_search the catalogue, data_describe a tool before you run it, then data_run it; prefer one well-chosen run over many. " +
  SOURCED;

/** The public data catalogue: search and describe are free reads; a run is priced and capped by the budget. */
const DATA = ["data_search", "data_describe", "data_run"];
const crewTools = (handoff: boolean) =>
  tools(["web_search", "web_fetch", ...crm("list_clients", "get_client", "list_posts", "create_draft_post"), ...DATA, ...(handoff ? HANDOFF : [])], OPERATOR);

/**
 * The per-client crew, a chain like `seo-geo`'s: the desk researcher frames the question and sizes
 * the market, hands its draft's `post_` id to the competitor analyst, who tears down the players it
 * names and hands those ids to the voice-of-customer analyst, who reads what their buyers say.
 */
const crew: AgentDecl[] = [
  {
    name: "desk-researcher",
    role: "Desk researcher",
    model,
    budget,
    description: "Frames the client's question and sizes the market from public sources, method shown.",
    system: `${clientGate} You are the desk researcher: restate the client's question in one sentence, then size the market top-down and bottom-up from public sources and file a market-sizing draft that shows both methods, where they disagree, and the players the sources keep naming. When it is filed, hand its post_ id to this client's competitor analyst with send_to_agent (wait false) — list_agents names the one seat you may reach — with the players to tear down. When the client's notes ask for trend tracking instead, file a trend-brief draft: what changed in the market since the last brief on list_posts, each change sourced, and what it means for the client.`,
    tools: crewTools(true),
    skills: ["naive/market-sizing", "naive/research-sourcing"],
    handoffs: ["competitor-analyst"],
    identity: AGENCY_IDENTITY,
  },
  {
    name: "competitor-analyst",
    role: "Competitor analyst",
    model,
    budget,
    description: "Tears down the competitors the sizing names: pricing, positioning, product, funding and stack.",
    system: `${clientGate} You are the competitor analyst. A session opened by the desk researcher names a post_ id: read that draft with list_posts and tear down the players it names, from their own sites and the data catalogue — pricing, positioning, product, funding, tech stack — and file one competitor-teardown draft with a comparison table. Then hand its post_ id to this client's voice-of-customer analyst with send_to_agent (wait false) — list_agents names the one seat you may reach.`,
    tools: crewTools(true),
    skills: ["naive/competitor-teardown", "naive/research-sourcing"],
    handoffs: ["voice-of-customer"],
    identity: AGENCY_IDENTITY,
  },
  {
    name: "voice-of-customer",
    role: "Voice-of-customer analyst",
    model,
    budget,
    description: "Reads what buyers say about the client and its competitors in reviews, forums and social.",
    system: `${clientGate} You are the voice-of-customer analyst. A session opened by the competitor analyst names post_ ids: read those drafts with list_posts first, then read what buyers say about the client and each competitor in public reviews, forums and social posts, and file one voc-report draft: the recurring jobs, complaints and switching reasons, each with verbatim quotes and links, and how many sources each theme rests on.`,
    tools: crewTools(false),
    skills: ["naive/voice-of-customer", "naive/research-sourcing"],
    handoffs: false,
    identity: AGENCY_IDENTITY,
  },
];

const clients: Client[] = [
  {
    id: "cli_mr01", slug: "fernway-bikes", name: "Fernway Bikes", domain: "fernwaybikes.example", stage: "active",
    services: ["Sizing", "Competitors"],
    contact: { name: "Sample Contact", email: "contact@fernwaybikes.example", role: "Founder" },
    notes: ["Demo row — question: is there room for a cargo e-bike subscription in three US metros?", "Board meeting on the 20th; wants the sizing first."],
    nextAction: "Send the sizing draft for review",
  },
  {
    id: "cli_mr02", slug: "lumen-health", name: "Lumen Health", domain: "lumenhealth.example", stage: "active",
    services: ["Customer insight"],
    contact: { name: "Sample Contact", email: "contact@lumenhealth.example", role: "Head of product" },
    notes: ["Demo row — question: why do clinics churn from scheduling software in year one?"],
    nextAction: "Walk through the voice-of-customer themes (Tue)",
  },
  {
    id: "cli_mr03", slug: "oakline-foods", name: "Oakline Foods", domain: "oaklinefoods.example", stage: "active",
    services: ["Competitors", "Trends"],
    contact: { name: "Sample Contact", email: "contact@oaklinefoods.example", role: "VP strategy" },
    notes: ["Demo row — tracking plant-based snack entrants each quarter."],
    nextAction: "Agree the Q4 trend brief topics",
  },
  {
    id: "cli_mr04", slug: "quarry-capital", name: "Quarry Capital", domain: "quarrycapital.example", stage: "proposal",
    services: ["Sizing"],
    contact: { name: "Sample Contact", email: "contact@quarrycapital.example", role: "Partner" },
    notes: ["Demo row — proposal sent: two diligence sizings a quarter."],
    nextAction: "Follow up on the proposal",
  },
  {
    id: "cli_mr05", slug: "tidewater-hotels", name: "Tidewater Hotels", domain: "tidewaterhotels.example", stage: "lead",
    services: [],
    contact: { name: "Sample Contact", email: "contact@tidewaterhotels.example", role: "CMO" },
    notes: ["Demo row — inbound from the site's contact form."],
    nextAction: "Book a scoping call",
  },
  {
    id: "cli_mr06", slug: "linden-realty", name: "Linden Realty", domain: "lindenrealty.example", stage: "churned",
    services: ["Sizing"],
    contact: { name: "Sample Contact", email: "contact@lindenrealty.example", role: "Broker" },
    notes: ["Demo row — one sizing project, finished in the spring."],
  },
];

const posts: Post[] = [
  { id: "post_mr101", clientId: "cli_mr01", title: "Cargo e-bike subscriptions: market size in three metros", summary: "Demo row — top-down and bottom-up sizing, both methods shown, every figure linked.", kind: "market-sizing", channel: "blog", status: "pending", agent: "desk-researcher--fernway-bikes", scheduledFor: "2026-11-03", hue: 30 },
  { id: "post_mr102", clientId: "cli_mr01", title: "Five subscription players, torn down", summary: "Demo row — pricing, positioning, funding and fleet size in one comparison table.", kind: "competitor-teardown", channel: "blog", status: "ready", agent: "competitor-analyst--fernway-bikes", scheduledFor: "2026-11-06", hue: 200 },
  { id: "post_mr103", clientId: "cli_mr01", title: "What riders say about bike subscriptions", summary: "Demo row — recurring complaints and switching reasons, quoted from public reviews.", kind: "voc-report", channel: "blog", status: "approved", agent: "voice-of-customer--fernway-bikes", scheduledFor: "2026-11-10", hue: 140 },
  { id: "post_mr201", clientId: "cli_mr02", title: "Why clinics leave scheduling software", summary: "Demo row — eight churn themes, each with the number of sources behind it.", kind: "voc-report", channel: "blog", status: "pending", agent: "voice-of-customer--lumen-health", scheduledFor: "2026-11-04", hue: 330 },
  { id: "post_mr202", clientId: "cli_mr02", title: "Clinic scheduling: who sells what, at what price", summary: "Demo row — six vendors compared on price, contract length and integrations.", kind: "competitor-teardown", channel: "blog", status: "posted", agent: "competitor-analyst--lumen-health", scheduledFor: "2026-10-21", postedAt: "7d ago", clicks: 140, impressions: 3_200, hue: 260 },
  { id: "post_mr203", clientId: "cli_mr02", title: "LinkedIn: three things clinic managers asked for", summary: "Demo row — rejected so you can see what that looks like.", kind: "article", channel: "linkedin", status: "rejected", agent: "voice-of-customer--lumen-health", scheduledFor: "2026-10-28", rejectedReason: "Demo row — two quotes had no link.", hue: 0 },
  { id: "post_mr301", clientId: "cli_mr03", title: "Q4 trend brief: new plant-based snack entrants", summary: "Demo row — launches, retail listings and funding rounds since July.", kind: "trend-brief", channel: "blog", status: "ready", agent: "desk-researcher--oakline-foods", scheduledFor: "2026-11-05", hue: 90 },
  { id: "post_mr302", clientId: "cli_mr03", title: "Snack aisle pricing, October", summary: "Demo row — shelf prices for twelve products across four retailers.", kind: "competitor-teardown", channel: "blog", status: "posted", agent: "competitor-analyst--oakline-foods", scheduledFor: "2026-10-14", postedAt: "14d ago", clicks: 62, impressions: 1_480, hue: 50 },
];

export const marketResearch: AgencyTemplate = {
  ...blank,
  name: "market-research",
  title: "Market research agency",
  description: VOCABULARY["market-research"].description,
  roadmap: { day_one: "Set up your site, pipeline and first research" },
  kinds: VOCABULARY["market-research"].kinds,
  words: { ...VOCABULARY["market-research"].words },
  seed: { clients, posts },
  questions: [
    {
      key: "offer",
      type: "text",
      label: "What research does your agency sell, and to whom?",
      help: questions[0]!.help,
      placeholder: "Market sizing and competitor teardowns for seed-to-Series-B consumer startups.",
    },
    questions[1]!,
    questions[2]!,
    {
      key: "coverage",
      type: "text",
      label: "Which markets do you cover, and what decisions do clients make with your research?",
      help: "The crew frames every client question from this, and the site's services are written from it.",
      placeholder: "US consumer hardware and mobility; clients decide whether to enter a market and how to price.",
    },
    // No network question: four is the limit. sales asks for the operator's network in its first session.
  ],
  crew,
  agents: specialise(blank.agents, { focus: FOCUS, skills: SKILLS, work: WORK }),
};
