/**
 * The `agency` blueprint, declared.
 *
 * This is the file `naive up` reads. A person clones this repo, sets NAIVE_API_KEY, runs
 * `naive up`, and the platform provisions everything below into their organization: one app per
 * primitive the template picks, and the chosen template's seven agents.
 * Re-running is idempotent — resources are keyed by name.
 *
 * The blueprint is the machine and is shared: the apps, `/api/*`, `/mcp`, the store, the sign-in
 * and the build do not change with the template. The template
 * is data — `templates/blank.ts` and `templates/seo-geo.ts` — and this repo carries **both**, so
 * switching is one edit in `templates/index.ts` plus `naive up`: never a re-clone, never a new app.
 *
 * Switching widens and never narrows. Agents the new template declares are created; agents only
 * the old one declared come back as `kept` and are left standing (deletion needs an explicit
 * `removed:` tombstone), and the operator's own rows — clients, posts, connections, the app, its
 * URL, its MCP token — are untouched. The per-client crew follows the same rule in
 * `server/proxy.ts`.
 *
 * Every app declares its MCP endpoint (`mcp: "/mcp"`), so every agent in the project is offered
 * each app's tools automatically on each turn — no per-agent wiring; the platform mints each app's
 * token and injects it as `VETTA_MCP_TOKEN`.
 *
 * Standalone clones install `@usenaive-sdk/blueprints` from npm; inside the monorepo it resolves
 * via the workspace protocol.
 */
import { defineProject } from "@usenaive-sdk/blueprints";
import { ACTIVE_TEMPLATE, TEMPLATES } from "./templates/active.ts";
import { AGENCY_IDENTITY } from "./templates/blank.ts";
import { ACTIVE, PROJECT, TEMPLATE, type AppId } from "./templates/index.ts";

/** What the Studio's Apps rail says each app is. */
const APP_DESCRIPTIONS: Record<AppId, string> = {
  crm: "Clients and the pipeline: leads, proposals, active clients, notes, referrals, and onboarding each client's team.",
  "landing-page": "The agency's public site, its blog, and the inbox for leads from its contact form.",
  "seo-geo": "Search work for clients — pages, articles, answer blocks, ranking reports and audits — with search measurement.",
  ads: "Ad work for clients — briefs, concepts, copy, statics and video — with the agency's ad accounts.",
  calendar: "Client meetings and the days each client deliverable is due, across every app.",
};

export default defineProject({
  name: PROJECT,
  blueprint: "agency",
  /** Chosen in `templates/index.ts`, so the config, the screens and the site cannot disagree. */
  template: TEMPLATE,
  /** What the studio calls this template and says it does, and its first week on the launch card. */
  title: ACTIVE_TEMPLATE.title,
  description: ACTIVE_TEMPLATE.description,
  roadmap: ACTIVE_TEMPLATE.roadmap,
  /** Every template this repo carries; the chosen one's agents become this project's crew. */
  templates: Object.values(TEMPLATES),
  /**
   * The ≤4 questions the studio asks before provisioning (plan §4). The answers become the project
   * context every agent reads first (`project_context`, canonical-spec §31.8); no `{ from_env }`
   * reader is needed for an answer to a declared question.
   */
  questions: ACTIVE_TEMPLATE.questions,
  /**
   * The team the CEO hires per client at onboarding (`server/crew.ts`), published so the studio can
   * show it. Names carry the client's slug at runtime, so only the shape is here.
   */
  crew_per_client: ACTIVE_TEMPLATE.crew.map(({ name, role, description }) => ({ name, role, description })),

  /**
   * The agency's persona, and the reason a connected account is reachable from an agent at all.
   *
   * Connection tools resolve `session → agent → agent_identity → identity → connected accounts`, so
   * an agent holding no identity is offered none of them — which is what every agent of this
   * blueprint was. The mailbox names in `templates/blank.ts` and the search and analytics names in
   * `templates/seo-geo.ts` were written, allow-listed and never once offered to a turn, and nothing
   * reported it: the resolver simply returned an empty list.
   *
   * Declaring the persona here and naming it on each agent (and on each schedule, which fires with
   * no operator behind it and would otherwise speak as nobody) is the grant. `up` refuses an agent
   * whose identity was not provisioned rather than creating one that runs as nobody, so a persona
   * dropped from this list fails the apply by name instead of quietly emptying every toolset.
   *
   * It is also the persona whose connected accounts the SEO & GEO and Ads apps list (the platform
   * writes its `idn_` id as `NAIVE_IDENTITY_ID`), so what they show is exactly what the agents reach.
   */
  identities: [
    {
      name: AGENCY_IDENTITY,
      description: "The agency itself — the persona its agents read, draft and connect accounts as.",
    },
  ],

  /**
   * One app per primitive the template picks (ADR-1766): `crm`, `landing-page`, `seo-geo`, `ads`.
   * Each is this repo's one build deployed on its own, told which it is by the literal `APP_ID`,
   * with its own database (so its own data) and its own MCP tools, which every agent is offered as
   * `<app>.<tool>`. There is no agency dashboard: the Studio draws the company, and each app opens
   * from its Apps rail with its own chat. Apps never call each other; agents carry data between
   * them. Every app's key is the read preset, so none can create an agent — the CEO hires each
   * client's team behind its approval cards (option B).
   *
   * `NAIVE_API_KEY` is minted by the platform as each app's own read key (§29.7, ADR-1484).
   * `DASHBOARD_TOKEN` and `DASHBOARD_PASSWORD` are `{ generate: true }`: the app's sign-in secret and
   * the password the Studio's Access panel shows, invented once by the platform on the apply that
   * creates the app and never readable back. `NAIVE_API_URL`, `NAIVE_STUDIO_URL` and `NAIVE_APP_ID`
   * are the platform's to write and are not declared here.
   */
  apps: ACTIVE.apps.map((id) => ({
    name: id,
    type: "fullstack" as const,
    description: APP_DESCRIPTIONS[id],
    deploy_dir: "dist",
    mcp: "/mcp",
    /** The CRM holds the clients every other app's work names; a template cannot run without it. */
    required: id === "crm",
    env: {
      APP_ID: id,
      NAIVE_API_KEY: { from_env: "NAIVE_API_KEY" },
      DASHBOARD_TOKEN: { generate: true as const },
      DASHBOARD_PASSWORD: { generate: true as const },
    },
  })),

  // No `agents:` here. They are the template's — `templates/agents.ts` declares the seven every
  // agency has, `templates/seo-geo.ts` adds its focus to them, and the per-client crew
  // (`seo-writer--<slug>`, …) is hired at onboarding by the CEO from `crm.get_client_crew`, since
  // its names carry a client slug and cannot be declared statically.
});
