/**
 * The `agency` blueprint, declared.
 *
 * This is the file `naive up` reads. A person clones this repo, sets NAIVE_API_KEY, runs
 * `naive up`, and the platform provisions everything below into their organization: the dashboard
 * app, the public site and the chosen template's agents. Re-running is idempotent — resources are
 * keyed by name.
 *
 * The blueprint is the machine and is shared: the screens, `/api/*`, `/mcp`, the store, the
 * operator bearer, the build and the approval flow do not change with the template. The template
 * is data — `templates/blank.ts` and `templates/seo-geo.ts` — and this repo carries **both**, so
 * switching is one edit in `templates/index.ts` plus `naive up`: never a re-clone, never a new app.
 *
 * Switching widens and never narrows. Agents the new template declares are created; agents only
 * the old one declared come back as `kept` and are left standing (deletion needs an explicit
 * `removed:` tombstone), and the operator's own rows — clients, posts, connections, the app, its
 * URL, its MCP token — are untouched. The per-client crew follows the same rule in
 * `server/proxy.ts`.
 *
 * The dashboard declares its MCP endpoint (`mcp: "/mcp"`), so every agent in the project is
 * offered the dashboard's CRM tools automatically on each turn — no per-agent wiring; the platform
 * mints the token and injects it into the app as `VETTA_MCP_TOKEN`.
 *
 * Standalone clones install `@usenaive-sdk/blueprints` from npm; inside the monorepo it resolves
 * via the workspace protocol.
 */
import { defineProject } from "@usenaive-sdk/blueprints";
import { TEMPLATES } from "./templates/active.ts";
import { TEMPLATE } from "./templates/index.ts";

export default defineProject({
  name: "agency",
  blueprint: "agency",
  /** Chosen in `templates/index.ts`, so the config, the screens and the site cannot disagree. */
  template: TEMPLATE,
  /** Every template this repo carries; the chosen one's agents become this project's crew. */
  templates: Object.values(TEMPLATES),

  apps: [
    {
      name: "dashboard",
      type: "fullstack",
      description: "Agency dashboard — CRM pipeline, agency agents, per-client workspaces.",
      deploy_dir: "dist",
      mcp: "/mcp",
      /**
       * The deployed dashboard calls the platform on your behalf — the agency chat, the agent
       * roster, each client's connections, and the per-client crew provisioned at onboarding — so
       * it needs the same key you run `naive up` with. `{ from_env }` reads your shell at apply
       * time, so no secret sits in this file and an unset variable refuses the apply by name. The
       * other two are literals and only when set: a base URL and an identity id are not secrets,
       * and a `{ from_env }` on an unset optional would refuse the whole apply.
       *
       * Without the key the dashboard still runs: the CRM and the deliverable queue are the app's
       * own database, so they work, and every platform-backed route answers 503 "not configured"
       * in the screen that asked for it instead of pretending.
       *
       * `DASHBOARD_TOKEN` is the operator's own bearer for `/api/*` — the CRM holds client
       * contacts and their email addresses, the roster holds system prompts, and the queue and the
       * session relay are writable, so the deployed URL cannot be open. Generate one yourself
       * (`openssl rand -hex 32`) and export it before `naive up`; the dashboard asks for it once
       * and keeps it for the tab. `{ from_env }` again, so it is never written down here, and an
       * unset variable refuses the apply by name rather than deploying an open dashboard — the
       * server itself answers 503 on every `/api/*` route if it ever arrives without one.
       */
      env: {
        NAIVE_API_KEY: { from_env: "NAIVE_API_KEY" },
        DASHBOARD_TOKEN: { from_env: "DASHBOARD_TOKEN" },
        ...(process.env["NAIVE_API_URL"] ? { NAIVE_API_URL: process.env["NAIVE_API_URL"] } : {}),
        ...(process.env["NAIVE_IDENTITY_ID"] ? { NAIVE_IDENTITY_ID: process.env["NAIVE_IDENTITY_ID"] } : {}),
      },
    },
    {
      name: "site",
      type: "frontend_only",
      description: "Public agency website — services, case studies, pricing, contact form into the CRM.",
      deploy_dir: "site/dist",
    },
  ],

  // No `agents:` here. They are the template's — `templates/blank.ts` declares the pair every
  // agency has, `templates/seo-geo.ts` adds its focus to them, and the per-client crew
  // (`seo-writer--<slug>`, …) is provisioned at onboarding by the dashboard server, since its
  // names carry a client slug and cannot be declared statically.
});
