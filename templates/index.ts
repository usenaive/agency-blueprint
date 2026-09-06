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
 * and reports the ones only the old one did (`kept` in the engine, and `provisionClientAgents` for
 * the per-client crew), and the operator's own rows — clients, posts, connections, the app, its URL,
 * its MCP token — are never touched by a switch.
 *
 * This module is the browser's half, so it carries no agents and no demo rows: those live in
 * `templates/blank.ts` and `templates/seo-geo.ts`, which only the config and the server import.
 */
import type { TemplateKind } from "@usenaive-sdk/blueprints";

export type TemplateName = "blank" | "seo-geo";

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
}

const blank: TemplateVocabulary = {
  description: "A working agency with no specialism: a sales agent and a client manager, generic deliverables.",
  kinds: [
    { id: "post", label: "Post", description: "A published piece — blog, newsletter or social." },
    { id: "page", label: "Page", description: "A page on the client's own site — landing, service or product." },
    { id: "report", label: "Report", description: "A recurring report on the work and what it moved." },
    { id: "audit", label: "Audit", description: "A review of the client's site, channels or campaigns." },
  ],
  words: {
    brand: "Northwind Agency",
    crmSubtitle: "Every prospect and client, by pipeline stage — the sales agent works this board.",
    onboarding:
      "Moving a client to active onboards them: the client manager picks up their calendar and queue, and every deliverable it files waits here for you.",
    clientsSubtitle: "Every active engagement — open one to see its connections, calendar, agents and deliverables.",
    noActiveClients: "No active clients yet — advance one on the CRM.",
    agentsSubtitle: "Every agent working for this agency.",
    noCrew:
      "No agents of this client's own. This template runs every client through the agency's own pair; a template with a per-client crew provisions one at onboarding.",
  },
  site: {
    tagline: "The work, planned and shown before it ships.",
    eyebrow: "Strategy · Content · Reporting",
    title: "An agency that shows you the work before it ships.",
    subtitle:
      "We plan the quarter, produce the work and report what it moved — with every deliverable in an approval queue you hold the key to.",
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
  description: "The agency, specialised in search: audits, SERP work and answer-engine optimization, with a crew per client.",
  kinds: [
    { id: "article", label: "Article", description: "A ranking article written against the client's keyword map." },
    { id: "landing-page", label: "Landing page", description: "A page built for one query and one intent." },
    { id: "answer-block", label: "Answer block", description: "An entity-dense Q&A block written to be cited by AI answer engines." },
    { id: "serp-report", label: "SERP report", description: "Where the client ranks, and against whom." },
    { id: "audit", label: "Audit", description: "A technical and content sweep of the client's site." },
  ],
  words: {
    brand: "Meridian Search",
    crmSubtitle: "Every prospect and client, by pipeline stage — the sales agent works this board, search presence first.",
    onboarding:
      "Moving a client to active onboards them and provisions their crew — an SEO writer, a GEO optimizer and an audit runner, each named for the client.",
    clientsSubtitle: "Every active engagement — open one to see its connections, calendar, crew and deliverables.",
    noActiveClients: "No active clients yet — advance one on the CRM.",
    agentsSubtitle: "Every agent working for this agency — the pair that runs it, and each client's crew.",
    noCrew: "No agents for this client yet — onboarding a client provisions its crew.",
  },
  site: {
    tagline: "Be the answer, everywhere people ask.",
    eyebrow: "SEO · GEO · Content",
    title: "Search is changing. Your visibility shouldn't.",
    subtitle:
      "We make companies findable in classic search and in AI answers alike — technical SEO, generative-engine optimization and content that earns citations, not just clicks.",
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

export const VOCABULARY: Record<TemplateName, TemplateVocabulary> = { blank, "seo-geo": seoGeo };

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
 */
const chosen = process.env["NAIVE_TEMPLATE"];
export const TEMPLATE: TemplateName =
  chosen === "blank" || chosen === "seo-geo" ? chosen : "seo-geo";

export const ACTIVE = VOCABULARY[TEMPLATE];

/** The label for a stored kind; a kind from another template shows its own id rather than nothing. */
export const kindLabel = (kind: string): string => ACTIVE.kinds.find((k) => k.id === kind)?.label ?? kind;
