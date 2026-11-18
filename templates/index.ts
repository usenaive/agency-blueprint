/**
 * The `agency` blueprint's template — the half a screen may read.
 *
 * The **blueprint** is the machine, and it is shared: the screens, `/api/*`, `/mcp`, the store and
 * its row lock, the operator bearer, the build, the deploy, the approval flow, the empty-state
 * policy. None of that is in here or in any template.
 *
 * A **template** is data: the agents and their prompts, their tool allow-lists, the deliverable
 * kinds, the schedules, the demo seed, the screen vocabulary and the onboarding copy. The agency
 * has one, `blank`; a specialism is a team (`crews/`) a company adds beside it.
 *
 * This module is the browser's half, so it carries no agents and no demo rows: those live in
 * `templates/blank.ts`, which only the config and the server import.
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
}

/**
 * `blank` alone (ADR-3010 in usenaive/vetta-mono): SEO & GEO and Product design are teams now,
 * `crews/clients-seo-geo/` and `crews/clients-product-design/`, which a company adds beside this one.
 */
export type TemplateName = "blank";

/**
 * The project's name on the platform — `defineProject({ name })` and the `?project=` the dashboard
 * narrows the installs list by when it looks up this project's context (`server/proxy.ts`).
 */
export const PROJECT = "agency";

/** The words a screen prints that change with the template. The layout around them does not. */
export interface TemplateWords {
  /** The demo agency's name in the rail — rename it to yours. */
  brand: string;
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
  description: "A working agency with no specialism: eight agents — site, sales, delivery, content, revisions, research, proposals, inbox — and generic deliverables.",
  kinds: [
    { id: "post", label: "Post", description: "A published piece — blog, newsletter or social." },
    { id: "page", label: "Page", description: "A page on the client's own site — landing, service or product." },
    { id: "report", label: "Report", description: "A recurring report on the work and what it moved." },
    { id: "audit", label: "Audit", description: "A review of the client's site, channels or campaigns." },
  ],
  words: {
    brand: "Northwind Agency",
    clientsSubtitle: "Every active engagement — open one to see its connections, calendar, agents and deliverables.",
    noActiveClients: "No clients yet — a deal marked won on the CRM becomes one, onboarded with its workspace and team.",
    agentsSubtitle: "Every agent working for this agency.",
    noCrew:
      "No agents of this client's own. This template runs every client through the agency's own eight; a template with a per-client team provisions one at onboarding.",
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

export const VOCABULARY: Record<TemplateName, TemplateVocabulary> = { blank };

/**
 * The template this repository runs, and the one `naive.config.ts` declares to the platform. Every
 * screen reads it from here, so the dashboard, the site and the MCP tool schema cannot disagree.
 */
export const TEMPLATE: TemplateName = "blank";

export const ACTIVE = VOCABULARY[TEMPLATE];

/** The label for a stored kind; a kind from another template shows its own id rather than nothing. */
export const kindLabel = (kind: string): string => ACTIVE.kinds.find((k) => k.id === kind)?.label ?? kind;
