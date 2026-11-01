/**
 * `advertising` — the same agency, specialised in advertising: paid campaigns and the creative that
 * runs in them (owner, 2026-10-31: the paid ads agency and this one are one agency). Per client, a
 * media planner audits the ad accounts read-only and writes the campaign plan; the creative chain
 * makes the brief, concepts, copy, statics and spots; a performance analyst reports each week.
 *
 * Like `seo-geo` it is a **delta on `blank`** (`specialise`): the seven keep their model, budget,
 * timers, intakes and allow-lists. No seat holds a tool that can launch a campaign, change an ad
 * account or spend: the ad tools are reads, every plan is a proposal, and a person makes each change.
 *
 * Generation is where this template spends: the designer and the video producer carry their own,
 * larger budget, and each video render is held at `ask`, so a spot costs nothing until the operator
 * approves the render. The figures are a first guess, to be set from staging runs.
 */
import type { AgentDecl } from "@usenaive-sdk/blueprints";
import type { Client } from "../seed/clients.ts";
import type { Post } from "../seed/posts.ts";
import { AGENCY_IDENTITY, appTools, blank, budget, crm, gate, HANDOFF, model, OPERATOR, questions, specialise, tools, type AgencyTemplate } from "./blank.ts";
import { VOCABULARY } from "./index.ts";

/** The lines no ad from this agency crosses, repeated wherever an ad is written or made. */
const SAFE =
  "Never use a real person's likeness or voice without a release the client's notes record, a competitor's trademark, or a claim about the product the client has not substantiated in its notes or on its own site.";

const FOCUS: Record<string, string> = {
  "site-builder":
    "This agency runs paid ads and makes them: the services section names paid media (audits, plans, reporting), concepts, copy, and static and video production; the FAQ says every campaign, budget and bid change is approved by the client before it is made. Show no portfolio piece the context does not name.",
  sales:
    "This agency makes ads: read the prospect's site and any public ads before each opener, so its spec idea fits.",
  "client-manager":
    "Deliverables here run from account audit and campaign plan through the creative to the weekly performance report; keep each client's calendar full and its team on the next one.",
  "content-writer":
    "Write each post about one craft question a buyer of ads asks, filed as kind article; claim no result or client you were not given.",
  "content-reviser":
    "Weak here means: a post with no worked example, an example that names a brand without permission, or advice that no longer matches the platform's ad specs.",
  "gap-researcher":
    "Compare the agency against rival ad agencies: the channels they run, the formats they show, how they report, and how they present their process.",
  "proposal-writer":
    "Tiers are scoped in channels managed, concepts, copy sets, statics and video spots per month, with the client's media spend stated separately as theirs; a proposal never promises a performance figure.",
};

const SKILLS: Record<string, string[]> = {
  sales: ["naive/ad-concepting"],
  "client-manager": ["naive/creative-brief", "naive/paid-ads-reporting"],
  "proposal-writer": ["naive/paid-ads-campaign-plan"],
};

const WORK: Record<string, string> = {
  sales:
    "In this agency every cold opener (not the personal notes to people the operator knows) carries one spec ad idea in a single line, drawn from what the prospect's own site or public ads say. " +
    "File the idea and what it came from as a note on the lead with add_client_note. Never say the idea was produced or tested.",
};

/** The gate for an agent that works inside one client's account rather than the agency's. */
const clientGate =
  `You work for an advertising agency on one client's account. ${gate} ` +
  "The client is the CRM row your name ends in (list_clients, get_client); its notes hold the brief, the brand rules and any releases. File every deliverable as a pending draft on that client with create_draft_post, in full, and read list_posts first so you do not file what is already queued. " +
  `You read ad accounts and never change them: you launch, pause and edit no campaign, set no budget or bid and spend nothing — every change is a proposal the operator approves and a person makes. ${SAFE}`;

/**
 * What has already run on the client's own connected ad accounts, read-only — the creative director
 * briefs from what worked rather than from a guess. Reads only, so every one is `allow`.
 */
const AD_READ = ["metaads.get_ad_accounts", "metaads.get_insights", "metaads.read_adsets", "googleads.list_accessible_customers", "googleads.get_campaign_by_id", "googleads.search_stream_gaql"];

/** Generation's own budget for the two seats that render. A first guess; retune from staging. */
const production = { cap_micro_usd: 150_000_000, max_task_micro_usd: 60_000_000, period: "day" } as const;

const base = ["web_search", "web_fetch", ...crm("list_clients", "get_client"), ...appTools("ads", "list_posts", "create_draft_post")];

/**
 * The per-client crew, a chain: the media planner audits the accounts and plans the campaigns, and
 * hands the plan's `post_` id to the creative director and to the performance analyst. The creative
 * director writes the brief and three concepts and hands their `post_` ids to the copywriter, whose
 * copy sets go to both makers — the designer for statics and the video producer for spots.
 */
const crew: AgentDecl[] = [
  {
    name: "media-planner",
    role: "Media planner",
    model,
    budget,
    description: "Audits the client's ad accounts read-only and writes the campaign plan the creative is made for.",
    system: `${clientGate} You are the media planner: read the client's notes for its goal, target cost and monthly budget range, then read its connected ad accounts for the last 30 and 90 days. File one account-audit draft — spend by campaign, results and cost against target, waste, tracking, what is missing, each finding with its number and date range — then one campaign-plan draft: goal, channels, campaigns with audience, daily budget and bid strategy inside the client's range, the creative each needs, measurement and one test. With no account connected, say so in the audit and plan from the client's notes alone. Hand the plan's post_ id to this client's creative director and to its performance analyst with send_to_agent (wait false) — list_agents names the seats you may reach.`,
    tools: tools([...base, ...AD_READ, ...HANDOFF], OPERATOR),
    skills: ["naive/paid-ads-audit", "naive/paid-ads-campaign-plan"],
    handoffs: ["creative-director", "performance-analyst"],
    identity: AGENCY_IDENTITY,
  },
  {
    name: "creative-director",
    role: "Creative director",
    model,
    budget,
    description: "Writes the creative brief and three campaign concepts from the client's goals, brand and past ads.",
    system: `${clientGate} You are the creative director. A session opened by the media planner names a post_ id: read that campaign plan with list_posts first, for the formats and placements it needs. Read the client's notes, its own site, the ads it runs publicly and, when connected, what its ad accounts say has worked. File one creative-brief draft — audience, single-minded message, mandatories, formats — then three campaign-concept drafts, each a different angle with a line and a key visual described. Hand the concepts' post_ ids to this client's copywriter with send_to_agent (wait false) — list_agents names the one seat you may reach.`,
    tools: tools([...base, ...AD_READ, ...HANDOFF], OPERATOR),
    skills: ["naive/creative-brief", "naive/ad-concepting"],
    handoffs: ["copywriter"],
    identity: AGENCY_IDENTITY,
  },
  {
    name: "copywriter",
    role: "Copywriter",
    model,
    budget,
    description: "Writes headlines, body copy and scripts for each concept, per placement.",
    system: `${clientGate} You are the copywriter. A session opened by the creative director names post_ ids: read those concept drafts with list_posts first. For each concept file one ad-copy draft: headline and body variants per placement within each platform's limits, and a 15-second and a 30-second script. Then hand the copy drafts' post_ ids to this client's designer and to its video producer with send_to_agent (wait false) — list_agents names the seats you may reach.`,
    tools: tools([...base, ...HANDOFF], OPERATOR),
    skills: ["naive/ad-copy-variants"],
    handoffs: ["designer", "video-producer"],
    identity: AGENCY_IDENTITY,
  },
  {
    name: "designer",
    role: "Designer",
    model,
    budget: production,
    description: "Makes the static ads for each concept in every placement size the brief names.",
    system: `${clientGate} You are the designer. A session opened by the copywriter names post_ ids: read those copy drafts with list_posts first. For each concept, generate_image the key visual in each placement size the brief names, look at every image with view_image before filing it, regenerate once if it breaks the brief, and file one static-ad draft per concept listing each image's fil_ id, its size and the copy it carries. find_stock_photo is for backgrounds only, never a person standing in for the client's customer.`,
    tools: tools([...base, "generate_image", "view_image", "find_stock_photo"], OPERATOR),
    skills: ["naive/ad-asset-production"],
    handoffs: false,
    identity: AGENCY_IDENTITY,
  },
  {
    name: "video-producer",
    role: "Video producer",
    model,
    budget: production,
    description: "Makes short video spots from the scripts: key frames, renders, voice-over and music.",
    system: `${clientGate} You are the video producer. A session opened by the copywriter names post_ ids: read those scripts with list_posts first. For the strongest script, generate_image one key frame per scene and check each with view_image, then propose one generate_video render per scene from its frame — each render waits for the operator, so file nothing as done until it lands. Add a voice-over with generate_speech and a bed with generate_music, and file one video-spot draft listing every fil_ id in order. A failed render is retried once; a second failure is reported, not retried.`,
    tools: tools([...base, "generate_image", "view_image", "generate_speech", "generate_music"], ["generate_video", ...OPERATOR]),
    skills: ["naive/ad-asset-production"],
    handoffs: false,
    identity: AGENCY_IDENTITY,
  },
  {
    name: "performance-analyst",
    role: "Performance analyst",
    model,
    budget,
    description: "Reports each week on spend, results and cost against the plan's target, and names the one decision needed.",
    system: `${clientGate} You are the performance analyst. A session opened by the media planner names a post_ id: read that campaign plan with list_posts first, then read the connected ad accounts and file a performance-report draft — the baseline, last 30 days, every number with its date range. Each later session files the week's performance-report draft: spend, conversions and cost per conversion by campaign against the plan's target, the two or three changes that explain the week, and the one decision the operator must make, with your recommendation. Never present a change as made, and never claim a cause the numbers do not show.`,
    tools: tools([...base, ...AD_READ], OPERATOR),
    skills: ["naive/paid-ads-reporting"],
    handoffs: false,
    identity: AGENCY_IDENTITY,
  },
];

const clients: Client[] = [
  {
    id: "cli_ad01", slug: "brightline-coffee", name: "Brightline Coffee", domain: "brightlinecoffee.example", stage: "active",
    services: ["Concepts", "Statics", "Video"],
    contact: { name: "Sample Contact", email: "contact@brightlinecoffee.example", role: "Head of brand" },
    notes: ["Demo row — brief: launch the oat cold brew to commuters; mandatories: logo end card, no health claims.", "No releases on file: no real people on screen."],
    nextAction: "Pick one of the three concepts",
  },
  {
    id: "cli_ad02", slug: "northpeak-gear", name: "Northpeak Gear", domain: "northpeakgear.example", stage: "active",
    services: ["Copy", "Statics"],
    contact: { name: "Sample Contact", email: "contact@northpeakgear.example", role: "Marketing manager" },
    notes: ["Demo row — winter jacket refresh across Meta and display placements."],
    nextAction: "Review the static set (Thu)",
  },
  {
    id: "cli_ad03", slug: "kindred-pets", name: "Kindred Pets", domain: "kindredpets.example", stage: "active",
    services: ["Video"],
    contact: { name: "Sample Contact", email: "contact@kindredpets.example", role: "Founder" },
    notes: ["Demo row — 15-second spots for the subscription box, vertical first."],
    nextAction: "Approve the first render",
  },
  {
    id: "cli_ad04", slug: "solace-sleep", name: "Solace Sleep", domain: "solacesleep.example", stage: "proposal",
    services: ["Concepts", "Video"],
    contact: { name: "Sample Contact", email: "contact@solacesleep.example", role: "CMO" },
    notes: ["Demo row — proposal sent: three concepts and four spots a month."],
    nextAction: "Follow up on the proposal",
  },
  {
    id: "cli_ad05", slug: "harborline-ferries", name: "Harborline Ferries", domain: "harborlineferries.example", stage: "lead",
    services: [],
    contact: { name: "Sample Contact", email: "contact@harborlineferries.example", role: "Commercial director" },
    notes: ["Demo row — inbound from the site's contact form; summer season campaign."],
    nextAction: "Book a briefing call",
  },
  {
    id: "cli_ad06", slug: "copperleaf-tea", name: "Copperleaf Tea", domain: "copperleaftea.example", stage: "churned",
    services: ["Copy"],
    contact: { name: "Sample Contact", email: "contact@copperleaftea.example", role: "Founder" },
    notes: ["Demo row — paused after the holiday campaign."],
  },
];

const posts: Post[] = [
  { id: "post_ad001", clientId: "cli_ad02", title: "Account audit: Meta and Google, last 90 days", summary: "Demo row — 31% of spend on two ad sets with no conversions; purchase event not firing on mobile.", kind: "account-audit", channel: "blog", status: "approved", agent: "media-planner--northpeak-gear", scheduledFor: "2026-10-28", hue: 15 },
  { id: "post_ad002", clientId: "cli_ad02", title: "Winter campaign plan: prospecting and retargeting", summary: "Demo row — two campaigns inside the client's monthly range, one creative test, tracking fixed first.", kind: "campaign-plan", channel: "blog", status: "pending", agent: "media-planner--northpeak-gear", scheduledFor: "2026-11-02", hue: 45 },
  { id: "post_ad003", clientId: "cli_ad02", title: "Weekly report: week of Oct 26", summary: "Demo row — on target: cost per purchase down 12% as the new audience ramped; one decision on budget.", kind: "performance-report", channel: "blog", status: "ready", agent: "performance-analyst--northpeak-gear", scheduledFor: "2026-11-01", hue: 75 },
  { id: "post_ad101", clientId: "cli_ad01", title: "Creative brief: oat cold brew launch", summary: "Demo row — commuters 25–40, one message: smooth enough to drink black.", kind: "creative-brief", channel: "blog", status: "approved", agent: "creative-director--brightline-coffee", scheduledFor: "2026-11-02", hue: 30 },
  { id: "post_ad102", clientId: "cli_ad01", title: "Concept A: “The quiet ten minutes”", summary: "Demo row — the commute as the one calm part of the day.", kind: "campaign-concept", channel: "blog", status: "pending", agent: "creative-director--brightline-coffee", scheduledFor: "2026-11-03", hue: 200 },
  { id: "post_ad103", clientId: "cli_ad01", title: "Concept B: “Black, no regrets”", summary: "Demo row — a dare to skip the milk, with a taste-test frame.", kind: "campaign-concept", channel: "blog", status: "pending", agent: "creative-director--brightline-coffee", scheduledFor: "2026-11-03", hue: 220 },
  { id: "post_ad104", clientId: "cli_ad01", title: "Copy set for Concept A", summary: "Demo row — five headlines, three bodies, a 15s and a 30s script.", kind: "ad-copy", channel: "x", status: "ready", agent: "copywriter--brightline-coffee", scheduledFor: "2026-11-05", hue: 260 },
  { id: "post_ad201", clientId: "cli_ad02", title: "Winter refresh statics: 1:1, 4:5, 9:16", summary: "Demo row — three sizes per concept, copy set in each.", kind: "static-ad", channel: "linkedin", status: "pending", agent: "designer--northpeak-gear", scheduledFor: "2026-11-04", hue: 180 },
  { id: "post_ad202", clientId: "cli_ad02", title: "Headline set: “Built for the ugly days”", summary: "Demo row — within Meta's 40-character headline limit.", kind: "ad-copy", channel: "x", status: "posted", agent: "copywriter--northpeak-gear", scheduledFor: "2026-10-20", postedAt: "8d ago", clicks: 410, impressions: 18_600, hue: 120 },
  { id: "post_ad203", clientId: "cli_ad02", title: "Static with a borrowed slogan", summary: "Demo row — rejected so you can see what that looks like.", kind: "static-ad", channel: "linkedin", status: "rejected", agent: "designer--northpeak-gear", scheduledFor: "2026-10-27", rejectedReason: "Demo row — the line was too close to a competitor's tagline.", hue: 0 },
  { id: "post_ad301", clientId: "cli_ad03", title: "15s spot: “Unboxing Monday”", summary: "Demo row — four scenes, voice-over and a light music bed, vertical.", kind: "video-spot", channel: "x", status: "ready", agent: "video-producer--kindred-pets", scheduledFor: "2026-11-06", hue: 300 },
  { id: "post_ad302", clientId: "cli_ad03", title: "Script set for the subscription box", summary: "Demo row — three 15s scripts, each opening on the box.", kind: "ad-copy", channel: "blog", status: "approved", agent: "copywriter--kindred-pets", scheduledFor: "2026-10-30", hue: 330 },
];

export const advertising: AgencyTemplate = {
  ...blank,
  name: "advertising",
  title: "Advertising agency",
  description: VOCABULARY.advertising.description,
  roadmap: { day_one: "Set up your site, pipeline and first campaign plan" },
  kinds: VOCABULARY.advertising.kinds,
  words: { ...VOCABULARY.advertising.words },
  seed: { clients, posts },
  questions: [
    {
      key: "offer",
      type: "text",
      label: "What does your agency run and make, and for whom?",
      help: questions[0]!.help,
      placeholder: "Meta and Google campaigns, with short video and static ads, for DTC food and drink brands.",
    },
    questions[1]!,
    questions[2]!,
    {
      key: "formats",
      type: "text",
      label: "Which ad platforms do you run, and which formats do you make?",
      help: "The media planner plans channels and the crew sizes every static and spot from this; the site's services are written from it.",
      placeholder: "Meta and Google Ads; vertical video and statics, display banners on request.",
    },
    // No network question: four is the limit. sales asks for the operator's network in its first session.
  ],
  crew,
  agents: specialise(blank.agents, { focus: FOCUS, skills: SKILLS, work: WORK }),
};
