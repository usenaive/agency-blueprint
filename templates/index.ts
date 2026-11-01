/**
 * The `agency` blueprint's templates — the half a screen may read — and the one line that chooses
 * between them.
 *
 * The **blueprint** is the machine, and it is shared: the screens, `/api/*`, `/mcp`, the store and
 * its row lock, the operator bearer, the build, the deploy, the approval flow, the empty-state
 * policy. None of that is in here or in any template.
 *
 * A **template** is data: the agents and their prompts, their tool allow-lists, the deliverable
 * kinds, the schedules, the demo seed, the screen vocabulary and the onboarding copy. This repo
 * carries every template the blueprint has, so switching is the edit below plus `naive up` — never
 * a re-clone, never a new app, and never a lost row.
 *
 * Switching **widens and never narrows**: `naive up` creates the agents the new template declares
 * and reports the ones only the old one did (`kept` in the engine; `crm.get_client_crew` lists a
 * client's standing seats), and the operator's own rows — clients, posts, connections, the apps,
 * their URLs and MCP tokens — are never touched by a switch.
 *
 * This module is the browser's half, so it carries no agents and no demo rows: those live in
 * `templates/blank.ts` and `templates/seo-geo.ts`, which only the config and the server import.
 */
/**
 * One kind of work a template files — a deliverable kind, a post kind. `id` is what rows carry.
 * Declared here since engine 0.11, whose `Template` is only what the platform reads (name,
 * description, agents); the screens' half of a template is this blueprint's own business.
 */
export interface TemplateKind {
  id: string;
  label: string;
  description?: string;
  /** The app that files this kind; absent, the CRM files it on the client (ADR-1766). */
  app?: Exclude<AppId, "crm">;
}

export type TemplateName = "blank" | "seo-geo" | "market-research" | "advertising" | "security" | "recruiting";

/**
 * The primitive apps (ADR-1766): each is this repo deployed as its own app with `APP_ID` set, its
 * own database and its own MCP tools (`<app>.<tool>`). A template picks them by naming them in `apps`.
 */
export type AppId = "crm" | "landing-page" | "seo-geo" | "ads" | "calendar";
export const APP_IDS: readonly AppId[] = ["crm", "landing-page", "seo-geo", "ads", "calendar"];
/** Every agency gets all five (owner, 2026-10-31); a template that should not carry one leaves it out. */
const EVERY_APP: readonly AppId[] = APP_IDS;

/**
 * The project's name on the platform — `defineProject({ name })` and the `?project=` the dashboard
 * narrows the installs list by when it looks up this project's context (`server/proxy.ts`).
 */
export const PROJECT = "agency";

/** The words a screen prints that change with the template. The layout around them does not. */
export interface TemplateWords {
  /** The demo agency's name in the rail — rename it to yours. */
  brand: string;
  crmSubtitle: string;
  /** What graduating a client to active actually does under this template. */
  onboarding: string;
  clientsSubtitle: string;
  noActiveClients: string;
  agentsSubtitle: string;
  /** The client's Agents tab when the platform reports no crew for that client. */
  noCrew: string;
}

/** The specialism-bearing half of the public site; the rest of `site/site.config.ts` is the operator's. */
export interface TemplateSite {
  /** The one line under the company name. */
  tagline: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  cta: string;
  services: { name: string; headline: string; description: string; deliverables: string[] }[];
  contactSubtitle: string;
  footerNote: string;
}

export interface TemplateVocabulary {
  /** One line for the operator, shown on Settings. */
  description: string;
  /** The kinds of deliverable this template files; the screens name them in this order. */
  kinds: TemplateKind[];
  words: TemplateWords;
  site: TemplateSite;
  /** The dashboard apps this template plugs in, in sidebar order. */
  apps: readonly AppId[];
}

const blank: TemplateVocabulary = {
  description: "A working agency with no specialism: seven agents — site, pipeline, delivery, content, revisions, research, proposals — and generic deliverables.",
  kinds: [
    { id: "post", label: "Post", description: "A published piece — blog, newsletter or social." },
    { id: "page", label: "Page", description: "A page on the client's own site — landing, service or product.", app: "seo-geo" },
    { id: "report", label: "Report", description: "A recurring report on the work and what it moved." },
    { id: "audit", label: "Audit", description: "A review of the client's site, channels or campaigns." },
  ],
  words: {
    brand: "Northwind Agency",
    crmSubtitle: "Every prospect and client, by pipeline stage — the sales agent works this board.",
    onboarding:
      "Moving a client to active onboards them: the client manager picks up their calendar and queue, the proposal writer its proposal, and every deliverable they file waits here for you.",
    clientsSubtitle: "Every active engagement — open one to see its connections, calendar, agents and deliverables.",
    noActiveClients: "No active clients yet — advance one on the CRM.",
    agentsSubtitle: "Every agent working for this agency.",
    noCrew:
      "No agents of this client's own. This template runs every client through the agency's own seven; a template with a per-client team provisions one at onboarding.",
  },
  apps: EVERY_APP,
  site: {
    tagline: "The work, planned and shown before it ships.",
    eyebrow: "Strategy · Content · Reporting",
    title: "An agency that shows you the work before it ships.",
    subtitle:
      "We plan the work, make it and report on it, and you approve every piece before it ships.",
    cta: "Request a proposal",
    services: [
      {
        name: "Strategy",
        headline: "A quarter you can actually run",
        description: "We baseline where you stand, agree the goal, and turn it into a calendar with owners and dates.",
        deliverables: ["Baseline audit", "Quarterly roadmap", "Channel plan", "Working calendar"],
      },
      {
        name: "Content",
        headline: "Work made, not just planned",
        description: "Posts, pages and campaign copy produced against the plan and reviewed by you before anything ships.",
        deliverables: ["Editorial calendar", "Posts and pages", "Campaign copy", "Approval workflow — nothing posts unseen"],
      },
      {
        name: "Reporting",
        headline: "Numbers tied to the work",
        description: "One monthly report that ties what we shipped to what changed, and says what we are doing about it.",
        deliverables: ["Monthly report", "Channel dashboards", "Quarterly review", "Next-quarter recommendation"],
      },
    ],
    contactSubtitle: "Tell us what you are trying to move. We reply within one business day.",
    footerNote: "Strategy, content and reporting for growing companies.",
  },
};

const seoGeo: TemplateVocabulary = {
  description: "The agency, specialised in search: audits, SERP work and answer-engine optimization, with a team per client.",
  kinds: [
    { id: "article", label: "Article", description: "A ranking article written against the client's keyword map.", app: "seo-geo" },
    { id: "landing-page", label: "Landing page", description: "A page built for one query and one intent.", app: "seo-geo" },
    { id: "answer-block", label: "Answer block", description: "An entity-dense Q&A block written to be cited by AI answer engines.", app: "seo-geo" },
    { id: "serp-report", label: "SERP report", description: "Where the client ranks, and against whom.", app: "seo-geo" },
    { id: "audit", label: "Audit", description: "A technical and content sweep of the client's site.", app: "seo-geo" },
    { id: "ad-plan", label: "Paid ad plan", description: "A channel, audience, creative, budget-scenario and measurement proposal; never live spend.", app: "ads" },
  ],
  words: {
    brand: "Meridian Search",
    crmSubtitle: "Every prospect and client, by pipeline stage — the sales agent works this board, search presence first.",
    onboarding:
      "Moving a client to active asks your CEO to hire their team — an SEO writer, a GEO optimizer and an audit runner, each named for the client — and you approve each hire.",
    clientsSubtitle: "Every active engagement — open one to see its connections, calendar, team and deliverables.",
    noActiveClients: "No active clients yet — advance one on the CRM.",
    agentsSubtitle: "Every agent working for this agency — the seven that run it, and each client's team.",
    noCrew: "No agents for this client yet — onboarding a client provisions its team.",
  },
  apps: EVERY_APP,
  site: {
    tagline: "Be the answer, everywhere people ask.",
    eyebrow: "SEO · GEO · Content",
    title: "Search is changing. Your visibility shouldn't.",
    subtitle:
      "We make you findable in classic search and in AI answers, through technical SEO, answer-engine optimization and content.",
    cta: "Request a free audit",
    services: [
      {
        name: "SEO",
        headline: "Rank where buying decisions start",
        description:
          "Technical audits, site architecture and on-page work that compound. We fix what blocks crawlers before we chase keywords.",
        deliverables: ["Technical & content audits", "Keyword and topic maps", "Internal-link architecture", "Monthly ranking reports"],
      },
      {
        name: "GEO",
        headline: "Get cited by AI answer engines",
        description:
          "Generative-engine optimization: structured data, entity coverage, answer blocks and llms.txt so assistants quote you as the source.",
        deliverables: ["AI-citation baselines", "Schema & entity coverage", "llms.txt and answer blocks", "Citation tracking reports"],
      },
      {
        name: "Content",
        headline: "Pages that earn links and answers",
        description:
          "Briefs, pillar pages and landing copy written against your keyword map and reviewed by you before anything ships.",
        deliverables: ["Editorial calendar", "Pillar pages & briefs", "Landing-page copy", "Approval workflow — nothing posts unseen"],
      },
    ],
    contactSubtitle: "Tell us where you want to be found. We reply within one business day with a baseline of where you stand.",
    footerNote: "Search & generative-engine optimization.",
  },
};

const marketResearch: TemplateVocabulary = {
  description: "The agency, specialised in research: market sizing, competitor teardowns and voice-of-customer reports, every figure sourced, with a team per client.",
  kinds: [
    { id: "market-sizing", label: "Market sizing", description: "How big the market is, top-down and bottom-up, with both methods shown." },
    { id: "competitor-teardown", label: "Competitor teardown", description: "Pricing, positioning, product and funding of the players that matter." },
    { id: "voc-report", label: "Customer insight", description: "What buyers say in public reviews, forums and social, quoted and linked." },
    { id: "trend-brief", label: "Trend brief", description: "What changed in the market since the last brief, and what it means for the client." },
    { id: "article", label: "Article", description: "A post for the agency's own blog or the client's.", app: "landing-page" },
  ],
  words: {
    brand: "Fieldnote Research",
    crmSubtitle: "Every prospect and client, by pipeline stage — the sales agent works this board, one sourced fact per opener.",
    onboarding:
      "Moving a client to active asks your CEO to hire their team — a desk researcher, a competitor analyst and a voice-of-customer analyst, each named for the client — and you approve each hire.",
    clientsSubtitle: "Every active engagement — open one to see its question, calendar, team and reports.",
    noActiveClients: "No active clients yet — advance one on the CRM.",
    agentsSubtitle: "Every agent working for this agency — the seven that run it, and each client's research team.",
    noCrew: "No agents for this client yet — onboarding a client provisions its team.",
  },
  apps: EVERY_APP,
  site: {
    tagline: "Research you can check, line by line.",
    eyebrow: "Sizing · Competitors · Customer insight",
    title: "Decisions deserve numbers you can trace.",
    subtitle:
      "We size markets, tear down competitors and read what buyers say, and every figure links to its source.",
    cta: "Scope a research question",
    services: [
      {
        name: "Market sizing",
        headline: "How big, measured two ways",
        description: "Top-down and bottom-up sizing from public sources, with both methods shown and the gap between them explained.",
        deliverables: ["Question framing", "Top-down and bottom-up sizing", "Assumption register", "Sources for every figure"],
      },
      {
        name: "Competitors",
        headline: "Who you are up against, in detail",
        description: "Pricing, positioning, product and funding for the players that matter, in one table you can keep current.",
        deliverables: ["Competitor teardowns", "Comparison tables", "Pricing snapshots", "Quarterly refresh"],
      },
      {
        name: "Customer insight",
        headline: "What buyers say when you are not in the room",
        description: "Recurring needs, complaints and switching reasons from public reviews, forums and social, quoted and linked.",
        deliverables: ["Voice-of-customer reports", "Theme counts by source", "Verbatim quote banks", "Trend briefs"],
      },
    ],
    contactSubtitle: "Tell us the decision you are trying to make. We reply within one business day with how we would answer it.",
    footerNote: "Market research with every source shown.",
  },
};

const advertising: TemplateVocabulary = {
  description: "The agency, specialised in advertising: account audits and campaign plans, the creative to run — briefs, concepts, copy, statics and video spots — and weekly performance reports, with a team per client. Agents propose every spend change; none makes one.",
  kinds: [
    { id: "account-audit", label: "Account audit", description: "Where the money goes, what is wasted and what is missing, read from the client's ad accounts.", app: "ads" },
    { id: "campaign-plan", label: "Campaign plan", description: "Goal, channels, campaigns, budget split, creative needs and measurement — a proposal until you approve it.", app: "ads" },
    { id: "creative-brief", label: "Creative brief", description: "Audience, one message, mandatories and formats, agreed before any concept.", app: "ads" },
    { id: "campaign-concept", label: "Campaign concept", description: "One angle: the line, the key visual and how it plays across placements.", app: "ads" },
    { id: "ad-copy", label: "Ad copy", description: "Headlines, body copy and scripts per placement, within each platform's limits.", app: "ads" },
    { id: "static-ad", label: "Static ad", description: "Finished images in every placement size the brief names.", app: "ads" },
    { id: "video-spot", label: "Video spot", description: "A short video ad with voice-over and music, scene by scene.", app: "ads" },
    { id: "performance-report", label: "Performance report", description: "Spend, results and cost against target, what changed and the one decision needed.", app: "ads" },
    { id: "article", label: "Article", description: "A post for the agency's own blog.", app: "landing-page" },
  ],
  words: {
    brand: "Halfmoon Studio",
    crmSubtitle: "Every prospect and client, by pipeline stage — the sales agent works this board, one spec idea per opener.",
    onboarding:
      "Moving a client to active asks your CEO to hire their team — a media planner, a creative director, a copywriter, a designer, a video producer and a performance analyst, each named for the client — and you approve each hire.",
    clientsSubtitle: "Every active engagement — open one to see its plan, creative and reports.",
    noActiveClients: "No active clients yet — advance one on the CRM.",
    agentsSubtitle: "Every agent working for this agency — the seven that run it, and each client's media and creative team.",
    noCrew: "No agents for this client yet — onboarding a client provisions its team.",
  },
  apps: EVERY_APP,
  site: {
    tagline: "Ads made, shown to you, then shipped.",
    eyebrow: "Campaigns · Creative · Reporting",
    title: "Ads that start from a real brief.",
    subtitle:
      "We plan your campaigns and make the ads for them, and you approve every piece before it runs.",
    cta: "Brief us on a campaign",
    services: [
      {
        name: "Paid media",
        headline: "A plan before a single bid",
        description: "A read-only audit of your Google and Meta accounts, then a campaign plan — audiences, budget split, tests — and a weekly report. Every change is yours to approve.",
        deliverables: ["Account audit", "Campaign plan", "Weekly performance report", "Approval before any change"],
      },
      {
        name: "Concepts",
        headline: "Three angles, one brief",
        description: "A creative brief agreed with you, then three campaign concepts that each take a different angle on it.",
        deliverables: ["Creative brief", "Three campaign concepts", "Key visual direction", "Placement plan"],
      },
      {
        name: "Copy",
        headline: "Words cut to every placement",
        description: "Headlines, body copy and scripts for each concept, written to each platform's limits and your brand's voice.",
        deliverables: ["Headline and body variants", "15s and 30s scripts", "Caption sets", "Brand-voice checks"],
      },
      {
        name: "Production",
        headline: "Statics and spots, ready to run",
        description: "Static ads in every size you run and short video spots with voice-over and music, made from the chosen concept.",
        deliverables: ["Static ads in every size", "Short video spots", "Voice-over and music", "Approval before anything ships"],
      },
    ],
    contactSubtitle: "Tell us what you are launching and where it will run. We reply within one business day.",
    footerNote: "Paid campaigns and the creative to run in them.",
  },
};

const security: TemplateVocabulary = {
  description: "The agency, specialised in product testing: browser agents use each client's live product as a real customer would, then push on its edges and file every gap with steps to reproduce.",
  kinds: [
    { id: "journey-report", label: "Journey report", description: "One customer's path through the product, step by step: where it got hard and what broke." },
    { id: "gap-report", label: "Gap report", description: "Edge cases and red-team findings, worst first, each with steps, expected and actual." },
    { id: "retest", label: "Retest", description: "Earlier gaps retried after a fix: fixed or still open." },
    { id: "article", label: "Article", description: "A public post on the agency's own site.", app: "landing-page" },
  ],
  words: {
    brand: "Gatehouse Security",
    crmSubtitle: "Every prospect and client, by pipeline stage. Testing starts only once a client is active and has a test account on file.",
    onboarding: "Moving a client to active asks your CEO to hire their team: a customer tester and an edge-case tester, with a browser that reaches only the client's domain. You approve each hire.",
    clientsSubtitle: "Every active engagement: open one to see its journeys, gaps and retests.",
    noActiveClients: "No active clients yet — advance one on the CRM.",
    agentsSubtitle: "Every agent working for this agency, and each client's two testers.",
    noCrew: "No testers for this client yet. They are created when the client is onboarded and has a domain on file.",
  },
  apps: EVERY_APP,
  site: {
    tagline: "Your product, used by someone who wants it to work.",
    eyebrow: "Journeys · Edge cases · Retests",
    title: "We use your product like your next customer, then try to break it.",
    subtitle:
      "Testers use your live product like a new customer, then push on every edge, with test accounts only.",
    cta: "Book a test",
    services: [
      {
        name: "Journeys",
        headline: "Your product, as a first-time customer meets it",
        description: "A tester becomes your customer, with their goal, and walks from your homepage to the job they came for, noting every hesitation and every break.",
        deliverables: ["Journey report", "Every step, what was seen", "Steps to reproduce each gap", "Would this customer stay?"],
      },
      {
        name: "Edge cases",
        headline: "What happens when someone does it wrong",
        description: "The same journeys again, pushed: odd inputs, the back button, two tabs, a double click, a phone, a link opened logged out, one test account reaching another.",
        deliverables: ["Gap report, worst first", "Expected and actual", "What held", "Anything sensitive reported, never kept"],
      },
      {
        name: "Retests",
        headline: "Proof the fix landed",
        description: "When you ship a fix, the gap is retried the same way it was found and marked fixed or still open.",
        deliverables: ["Retest report", "Fixed or still open, per gap", "Approval before anything is sent"],
      },
    ],
    contactSubtitle: "Tell us what your product does and which journey worries you. We reply within one business day with how a test would run.",
    footerNote: "Product testing on live products, with the owner's permission and test accounts only.",
  },
};


const recruiting: TemplateVocabulary = {
  description: "The agency, specialised in recruiting: role briefs, sourced shortlists, screening and candidate outreach for clients' open roles, with a team per client.",
  kinds: [
    { id: "role-brief", label: "Role brief", description: "The role as the client needs it: must-haves, nice-to-haves, pay and where such people work now." },
    { id: "shortlist", label: "Shortlist", description: "Real people from public professional pages, each with why they fit and what is unconfirmed." },
    { id: "interview-kit", label: "Interview kit", description: "The same questions for every candidate, a scorecard, and one open question per person." },
    { id: "outreach-sequence", label: "Outreach sequence", description: "A first message and two follow-ups per shortlisted candidate, for you to approve and send." },
    { id: "article", label: "Article", description: "A post for the agency's own blog.", app: "landing-page" },
  ],
  words: {
    brand: "Northstar Talent",
    crmSubtitle: "Every hiring company you work with, by pipeline stage — the sales agent works this board, one open role per opener.",
    onboarding:
      "Moving a client to active asks your CEO to hire their team — a sourcer, a screener and an outreach writer, each named for the client — and you approve each hire.",
    clientsSubtitle: "Every active engagement — open one to see its roles, shortlists and outreach.",
    noActiveClients: "No active clients yet — advance one on the CRM.",
    agentsSubtitle: "Every agent working for this agency — the seven that run it, and each client's recruiting team.",
    noCrew: "No agents for this client yet — onboarding a client provisions its team.",
  },
  apps: EVERY_APP,
  site: {
    tagline: "The right people, found on purpose.",
    eyebrow: "Sourcing · Screening · Outreach",
    title: "Hire from a shortlist you can check.",
    subtitle:
      "We find the people who already do the work, score them the same way, and you approve every message.",
    cta: "Brief us on a role",
    services: [
      {
        name: "Sourcing",
        headline: "People who already do the job",
        description: "A written brief you confirm, then a shortlist of real people from public professional pages, each with the evidence that they fit.",
        deliverables: ["Role brief", "Shortlist of 8–15", "Evidence per must-have", "What we could not confirm"],
      },
      {
        name: "Screening",
        headline: "Everyone measured the same way",
        description: "Each person scored against your must-haves, and an interview kit with the same questions for every candidate.",
        deliverables: ["Must-have scoring", "Interview questions", "Scorecard", "Open questions per candidate"],
      },
      {
        name: "Outreach",
        headline: "Messages worth answering",
        description: "A first note and two follow-ups for each candidate, specific to their own work and honest about the role and pay. Nothing is sent without you.",
        deliverables: ["Outreach sequences", "Follow-up timing", "Reply handling notes", "Weekly pipeline update"],
      },
    ],
    contactSubtitle: "Tell us the role you are hiring for. We reply within one business day with how we would fill it.",
    footerNote: "Recruiting with every shortlist shown.",
  },
};

export const VOCABULARY: Record<TemplateName, TemplateVocabulary> = { blank, "seo-geo": seoGeo, "market-research": marketResearch, advertising, security, recruiting };

/**
 * **The line you edit to switch template**, then `naive up`. `naive.config.ts` declares it to the
 * platform and every screen reads it from here, so the dashboard, the site, the MCP tool schema and
 * the crew provisioned at onboarding can never disagree about which template is running.
 */
/**
 * The template this repository runs. Editing this line and running `naive up` is the switch, and
 * for an operator that is the whole story.
 *
 * `NAIVE_TEMPLATE` overrides it, and exists for exactly one caller: the platform's artifact
 * publisher builds EVERY template of this repository in one pass and cannot edit a file it does not
 * own between builds. Without the override it asked for `blank` and got this line's answer back, so
 * only the default template could ever be published. Unset — every run that is not that publisher —
 * nothing changes.
 *
 * The fallback is `blank`, the platform's own default for this blueprint (`BLUEPRINTS.agency.default`),
 * so a clone and a studio install with no template named get the same agency.
 */
const chosen = process.env["NAIVE_TEMPLATE"];
const isTemplate = (name: string | undefined): name is TemplateName => name !== undefined && Object.hasOwn(VOCABULARY, name);
export const TEMPLATE: TemplateName = isTemplate(chosen) ? chosen : "blank";

export const ACTIVE = VOCABULARY[TEMPLATE];

/** The label for a stored kind; a kind from another template shows its own id rather than nothing. */
export const kindLabel = (kind: string): string => ACTIVE.kinds.find((k) => k.id === kind)?.label ?? kind;
