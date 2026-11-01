# Agency as agents + primitive apps — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the agency's own dashboard with four separately hosted primitive apps (`crm`, `landing-page`, `seo-geo`, `ads`) that a template picks by id, each owning its data and MCP tools, and move client onboarding to the CEO behind approval cards.

**Architecture:** `apps/<id>/` holds each app: `server/` (its document shape, routes, MCP tools), `screen/` (its React page), built into `dist/<id>/` and declared as its own `fullstack` app in `naive.config.ts`. `kit/` holds what all four share (document store, MCP JSON-RPC, deployed entry, local server, sign-in through `@usenaive-sdk/app`, the deliverable queue). Apps never call each other; agents move data between them with `<app>.<tool>`.

**Tech Stack:** TypeScript (Node 22 strip-types), React 19, react-router 8, Vite, esbuild, vitest, `pg`, `@usenaive-sdk/app@0.1.0`, `@usenaive-sdk/blueprints@^0.11.4`.

**Spec:** `vetta-mono/development/memory/decisions.md` ADR-1766 (this plan implements it); contracts in `canonical-spec.md` §29.5 (app MCP tools), §29.7 (platform env), §29.10 (sign-in), ADR-1473 (CEO hand-off URL), ADR-1005/1484 (apps hold the read key).

## Global Constraints

- **Apps are template-agnostic** (owner, 2026-10-31: "customers should also be able to choose to add apps after the default deploy"). Nothing under `apps/*` or `kit/*` imports `templates/*`. What a template tailors arrives as literal env the template's `appDecl` writes: `APP_KINDS` (JSON `{id,label,description}[]`, the kinds this app files) and, for `crm` only, `CLIENT_CREW` (JSON `AgentDecl[]`). Absent: the app files no work of its own (`crm` falls back to a single `report` kind) and `crm`'s Onboard marks the client active with no crew. The same build therefore installs with a template or on its own.
- An app's key is the read preset; no app route or tool may call a platform write (`POST/PATCH/DELETE /v1/*`). The CEO does every write.
- No app reads a sibling's URL or calls a sibling. Cross-app flow is an agent calling two apps' tools.
- MCP tools reach agents as `<app-name>.<tool>`; app names are exactly `crm`, `landing-page`, `seo-geo`, `ads`.
- CEO hand-off URL: `${NAIVE_STUDIO_URL}/orchestrator?new=1&draft=<sentence>`; `NAIVE_STUDIO_URL` may be unset (staging, laptop) — then the screen shows the sentence to copy.
- Per-client seat name: `<seat>--<slug>`; handoffs rewritten to the same suffix; `CLIENT_DOMAIN` (`"{client.domain}"`) replaced in `config.allowed_domains`; a client with no domain gets no crew (refused with the reason).
- White-label: no vendor name in any screen, tool description or error.
- Files < ~300 lines, functions < ~50; every task leaves `pnpm test` and `pnpm typecheck` green under each `NAIVE_TEMPLATE` (blank, seo-geo, market-research, advertising, security).
- Money, ids, enums from `@usenaive-sdk/*`/the spec only; nothing ad hoc.
- Memory (vetta-mono `progress.md`, `decisions.md`, README) updated in the same PR.

## Review Focus

1. **A client onboarded twice** (template switch, or the CEO re-run): `get_client_crew` must list existing seats so the CEO does not hire a duplicate `seat--slug`. Test in Task 3.
2. **A won client with no domain** on a template whose seats scope a browser: Onboard must refuse in the screen with the reason, not open a CEO chat that will fail. Test in Task 3.
3. **A lead filed twice by the sales seat** (two runs overlap): `landing-page.mark_lead_filed` on a filed lead is a no-op and `list_new_leads` never returns it again. Test in Task 4.
4. **An agent files a deliverable kind into the wrong app** (`ads.create_draft` with `kind: "article"`): refused naming the app that owns the kind. Test in Task 2 (kit queue).
5. **Signed-out visitor opens an app URL directly**: every screen route redirects to `<NAIVE_STUDIO_URL>/apps/<NAIVE_APP_ID>/open`, the password door when the studio URL is unset; `/mcp` still answers only its bearer; `landing-page`'s public routes stay open. Test in Task 1.

---

### Task 1: The kit — one app's server, store, sign-in and build, generalised

Extract what every app shares out of `server/` into `kit/`, so an app is a definition object.

**Files:**
- Create: `kit/app.ts` (the `AppDef` type), `kit/store.ts` (from `server/store.ts` document plumbing + `api-entry.ts` pg transaction), `kit/mcp.ts` (from `server/mcp.ts` JSON-RPC, tool table passed in), `kit/gate.ts` (`@usenaive-sdk/app` `enter`/`viewer`/`signInUrl`), `kit/entry.ts` (deployed function, from `server/api-entry.ts`), `kit/serve.ts` (local server, from `server/index.ts`), `build-apps.mjs` (replaces `build-api.mjs`)
- Test: `kit/store.test.ts`, `kit/mcp.test.ts`, `kit/gate.test.ts` (moved and narrowed from `server/*.test.ts`)
- Modify: `package.json` (add `@usenaive-sdk/app` `0.1.0`; scripts `build` → `node build-apps.mjs`, `serve` → `node --experimental-strip-types kit/serve.ts`), `vite.config.ts` (root = `apps/${APP}/screen`, outDir `dist/${APP}`)

**Interfaces:**
- Produces:
  ```ts
  interface AppDef<S> {
    id: "crm" | "landing-page" | "seo-geo" | "ads";
    empty(): S;                                   // the document a new app starts with
    routes: (req: ApiRequest, ctx: AppCtx<S>) => Promise<ApiReply | null>;
    tools: McpTool<S>[];                          // served at /mcp
    publicPaths?: (path: string) => boolean;      // open without sign-in (landing-page only)
  }
  interface AppCtx<S> { store(): Promise<DocStore<S>>; env: AppEnv; viewer: Viewer | null }
  interface DocStore<S> { read(): S; write(next: S): void }
  interface McpTool<S> { name: string; description: string; inputSchema: object; run(args: Record<string, unknown>, ctx: AppCtx<S>): Promise<unknown> }
  function handle<S>(app: AppDef<S>, req: ApiRequest, ctx: AppCtx<S>): Promise<ApiReply>; // gate → /mcp → routes → 404
  ```
  `ApiRequest`/`ApiReply` keep their current shapes from `server/routes.ts`.

- [ ] **Step 1: Write the failing tests** — `kit/gate.test.ts`: `handle()` on `GET /` signed-out answers 302 to `https://studio.test/apps/app_1/open` given `NAIVE_STUDIO_URL=https://studio.test`, `NAIVE_APP_ID=app_1`; answers the password door (200, contains `name="password"`) when `NAIVE_STUDIO_URL` is unset; `POST /mcp` without `Authorization: Bearer <VETTA_MCP_TOKEN>` answers 401 even signed in; a path `publicPaths` accepts answers 200 signed-out. `kit/store.test.ts`: the existing serialisation test (eight parallel writes, eight survive) against `DocStore`. `kit/mcp.test.ts`: `tools/list` returns the table's names; `tools/call` on an unknown name is a JSON-RPC error `-32602`.
- [ ] **Step 2: Run** `pnpm vitest run kit` — expect FAIL (modules missing).
- [ ] **Step 3: Implement** the files above by moving code, not rewriting it; the pg row is keyed by app id (`documents(id text primary key, body jsonb)`), so four apps on one database never share a row.
- [ ] **Step 4: Run** `pnpm vitest run kit` — PASS.
- [ ] **Step 5: Commit** `git commit -m "Extract the shared app kit from the dashboard server"`

### Task 2: The deliverable queue, shared by every app that files work

**Files:**
- Create: `kit/work.ts` (queue ops + its MCP tools), `kit/WorkQueue.tsx` (list, read, approve / ask for changes — from the client posts screen)
- Modify: `templates/index.ts` — `AppId = "crm" | "landing-page" | "seo-geo" | "ads"`; `TemplateKind.app?: Exclude<AppId, "crm">` (no app ⇒ crm); retag: seo-geo template's six kinds and blank's `page` → `"seo-geo"`; the agency-blog `article` in research, advertising and security → `"landing-page"`; ad kinds stay `"ads"`; `apps` per vocabulary = `["crm", "landing-page", "seo-geo", "ads"]`
- Test: `kit/work.test.ts`, `templates/templates.test.ts`

**Interfaces:**
- Consumes: `AppDef`, `McpTool`, `DocStore` (Task 1); `Post` (`seed/posts.ts`).
- Produces:
  ```ts
  function kindsOf(env: AppEnv): TemplateKind[];                // parsed APP_KINDS; [] when unset or malformed
  function workTools<S extends { work: Post[] }>(app: AppId): McpTool<S>[];        // kinds read per call from ctx.env
  // list_work {client?, status?}, create_draft {client, kind, title, body, slot?}, request_changes {id, note}
  function workRoutes<S extends { work: Post[] }>(app: AppId): AppDef<S>["routes"]; // GET /api/work, POST /api/work/:id/{approve,changes}
  ```
  Approve is a screen route only, never a tool (a person approves).

- [ ] **Step 1: Failing tests** — `kit/` and `apps/` import nothing from `templates/` (a test globbing their imports); `kindsOf({})` is `[]`; `kindsOf({ APP_KINDS: "not json" })` is `[]`; `create_draft` with a kind of another app is refused with `kind "article" is filed in seo-geo, not ads`; with an unknown kind, refused listing `kindsOf(app)`; a draft is `pending`; `POST /api/work/:id/approve` sets `approved`; every kind in every template belongs to exactly one app and every app a template names is in its `apps`.
- [ ] **Step 2: Run** `pnpm vitest run kit/work templates` — FAIL.
- [ ] **Step 3: Implement**; `WorkQueue` takes `{ app: AppId }` and reads `/api/work`.
- [ ] **Step 4: Run** — PASS under all five `NAIVE_TEMPLATE`s.
- [ ] **Step 5: Commit** `git commit -m "Give every app the same deliverable queue, scoped to its kinds"`

### Task 3: The `crm` app, and onboarding through the CEO

**Files:**
- Create: `apps/crm/server/index.ts` (`AppDef<CrmDoc>`), `apps/crm/server/crew.ts` (`clientCrew`, from `provisionClientAgents`/`scopeTo`), `apps/crm/screen/main.tsx`, `apps/crm/screen/Client.tsx` (overview, notes, the client's crm-kind work)
- Move: `src/apps/crm/Crm.tsx` → `apps/crm/screen/Crm.tsx`; the CRM tools from `server/mcp.ts` (`list_clients`, `get_client`, `create_lead`, `get_referral_link`, `list_referral_ready`, `record_referral_ask`, `advance_pipeline`, `add_client_note`) and their store logic from `server/store.ts`
- Test: `apps/crm/server/crew.test.ts`, `apps/crm/server/index.test.ts` (CRM cases moved from `server/routes.test.ts`, `server/mcp.test.ts`, `server/store.test.ts`)

**Interfaces:**
- Consumes: Task 1, Task 2 (`workTools("crm")`, `workRoutes("crm")`).
- Produces:
  ```ts
  interface CrmDoc { clients: Client[]; work: Post[] }   // Client gains onboarding?: { requestedAt: string }
  function clientCrew(client: Client, crew: AgentDecl[], existing: string[]):   // crew = parsed CLIENT_CREW, [] when unset
    { ok: true; create: AgentCreateBody[]; existing: string[]; identity: string | null } | { ok: false; reason: string };
  // MCP: get_client_crew {client} → clientCrew(...) with existing = agents_list names (read key)
  //      record_onboarding {client, agents: {name, id}[]} → stage "active", onboardedAt now, clears onboarding
  // Route: POST /api/clients/:id/onboard → { draft: string, url: string | null }
  ```
  Draft sentence (exact): `Onboard ${name} (${id}) from the CRM: read crm.get_client_crew for ${id}, hire each agent it lists exactly as written, give each the identity it names, then call crm.record_onboarding with their ids.`

- [ ] **Step 1: Failing tests** — `clientCrew` for `{slug:"acme", domain:"acme.test"}` on the security crew: names `customer-tester--acme`, `edge-tester--acme`; `customer-tester--acme` handoffs `["edge-tester--acme"]`; browser `allowed_domains` `["acme.test"]`; with `existing: ["customer-tester--acme"]` that seat is in `existing`, not `create`; domain `""` → `{ ok: false, reason: "acme has no domain, and this crew's browser is limited to the client's site" }`. Onboard route: with `NAIVE_STUDIO_URL=https://studio.test` → `url` = `https://studio.test/orchestrator?new=1&draft=` + the encoded sentence; unset → `url: null`; a client with no domain → 422 with the reason; with `CLIENT_CREW` unset the route answers `{ draft: null, url: null }` and sets the client active. No CRM route or tool issues a non-GET to the platform (assert on the injected `fetch`).
- [ ] **Step 2: Run** `pnpm vitest run apps/crm` — FAIL.
- [ ] **Step 3: Implement**; the screen's Onboard opens `url` with `target="_top"` (the app runs inside the Studio's frame), else shows the sentence with a Copy button.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `git commit -m "Make the CRM its own app; the CEO onboards a client's crew"`

### Task 4: The `landing-page` app — the public site, its articles and its lead inbox

**Files:**
- Create: `apps/landing-page/server/index.ts` (`AppDef<SiteDoc>`, `publicPaths` = `/`, `/blog/*`, `/sitemap.xml`, `/llms.txt`, `/api/site`, `/api/blog`, `POST /api/leads`), `apps/landing-page/screen/main.tsx` (operator page: site checks, articles queue, leads)
- Move: `site/` → `apps/landing-page/site/`; `server/public-site.ts` → `apps/landing-page/server/public.ts`; `apps/seo/checks.ts` (+test) → `apps/landing-page/server/checks.ts`; `get_site`/`update_site` tools; lead intake and `lead_window` from `server/routes.ts`/`store.ts`
- Test: `apps/landing-page/server/index.test.ts` (public-site and lead cases moved), `checks.test.ts` (moved)

**Interfaces:**
- Consumes: Tasks 1–2 (`workTools("landing-page")` for articles; a published article renders at `/blog/<slug>`).
- Produces:
  ```ts
  interface SiteDoc { site_profile: SiteProfile; work: Post[]; leads: Lead[]; lead_window?: { startedAt: number; count: number } }
  interface Lead { id: string; at: string; name: string; email: string; company?: string; note?: string; services?: string[]; ref?: string; filed: boolean }
  // MCP: get_site, update_site, list_new_leads (filed === false, oldest first), mark_lead_filed {id} (idempotent)
  ```

- [ ] **Step 1: Failing tests** — `POST /api/leads` signed-out stores an unfiled lead and keeps the 10-per-hour window (`LEADS_PER_WINDOW`); `list_new_leads` omits filed ones; `mark_lead_filed` twice is `{ ok: true }` both times and the lead is listed never again; `/blog/<slug>` 404s for a pending article and renders an approved one; `/sitemap.xml` lists approved articles only; checks tests pass unchanged.
- [ ] **Step 2: Run** `pnpm vitest run apps/landing-page` — FAIL.
- [ ] **Step 3: Implement** by moving; the referral `ref` code is stored on the lead as given (the CRM resolves it when the sales seat files the lead with `crm.create_lead {…, ref}`).
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `git commit -m "Make the public site its own app with a lead inbox"`

### Task 5: The `seo-geo` and `ads` apps

**Files:**
- Create: `apps/seo-geo/server/index.ts`, `apps/seo-geo/screen/main.tsx`, `apps/ads/server/index.ts`, `apps/ads/screen/main.tsx`
- Move: `src/apps/seo/Seo.tsx` → `apps/seo-geo/screen/Seo.tsx` minus the site checks (Task 4 took them); `src/apps/ads/Ads.tsx` → `apps/ads/screen/Ads.tsx`; both render `<WorkQueue app=…>` instead of `AppWork`
- Test: `apps/seo-geo/server/index.test.ts`, `apps/ads/server/index.test.ts`

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces: `AppDef<{ work: Post[] }>` for each; `GET /api/accounts` → `{ connector, status }[]` read with the app's key from `GET /v1/identities/{NAIVE_IDENTITY_ID}` connections (seo-geo: search and analytics; ads: `/ads/i`) — one GET, the only platform call either makes.

- [ ] **Step 1: Failing tests** — each app's `tools/list` is exactly `list_work`, `create_draft`, `request_changes`; `GET /api/accounts` with `NAIVE_IDENTITY_ID` unset answers `{ data: [], reason: "no identity" }`; ads filters to connectors matching `/ads/i`.
- [ ] **Step 2: Run** `pnpm vitest run apps/seo-geo apps/ads` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `git commit -m "Make SEO & GEO and Ads their own apps"`

### Task 6: Templates name apps; agents speak to apps; one app per id in the config

**Files:**
- Modify: `templates/agents.ts` (`crm()` helper → `tools(app: AppId, ...names)` producing `<app>.<name>`; prompts' `dashboard.<tool>` → the owning app's name: `get_site`/`update_site`/articles → `landing-page.`, client work by kind → its app, CRM tools → `crm.`; the sales seat gains `landing-page.list_new_leads`, `landing-page.mark_lead_filed`, `crm.create_lead` and its daily schedule's input names that pass), `templates/{seo-geo,security,research,advertising}.ts` (same renames), `naive.config.ts` (`apps: ACTIVE_TEMPLATE.apps.map(appDecl)`; `appDecl(id)` = `{ name: id, type: "fullstack", deploy_dir: \`dist/${id}\`, mcp: "/mcp", required: id === "crm", env: { NAIVE_API_KEY: { from_env: "NAIVE_API_KEY" }, DASHBOARD_PASSWORD: { generate: true }, APP_KINDS: JSON.stringify(kinds of id), CLIENT_CREW (crm only): JSON.stringify(ACTIVE_TEMPLATE.crew) } }`; `crew_per_client` unchanged)
- Test: `templates/templates.test.ts`, `naive.config.test.ts`

- [ ] **Step 1: Failing tests** — no prompt or allow-list under any template contains `dashboard.`; every `<app>.<tool>` an agent names is a tool that app's `tools` declares (import each `AppDef`); `defineProject` accepts the config under each template with four apps; the sales seat holds the three lead tools.
- [ ] **Step 2: Run** `pnpm test` under each `NAIVE_TEMPLATE` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS (naive.config.test.ts included once the engine release it waits on is installed; otherwise note it skipped).
- [ ] **Step 5: Commit** `git commit -m "Templates pick apps; agents call each app by name"`

### Task 7: Delete the agency dashboard

**Files:**
- Delete: `src/` (Shell, Home, Gate, main, screens, `src/apps` registry, `platform.ts`, `api.ts`, `data.ts`), `server/` (whatever Tasks 1–5 did not move: `/api/chat`, `/api/agents`, `/api/deployments`, `/api/context`, `/api/product-audit`, `/api/mcp/tokens`, social relay, `provisionClientAgents`), `build-api.mjs`
- Modify: `README.md` (a template is agents + apps; the four apps, their tools and data; onboarding through the CEO; local run `APP=<id> pnpm serve`), `package.json` description

- [ ] **Step 1: Run** `git grep -nE "provisionClientAgents|/api/chat|DASHBOARD_TOKEN|src/screens|dashboard\." -- ':!docs'` — expect no hits after deleting.
- [ ] **Step 2: Run** `pnpm typecheck && pnpm test` under each `NAIVE_TEMPLATE`, then `for a in crm landing-page seo-geo ads; do APP=$a pnpm -s build; done` — all green, four `dist/<id>/` trees each with `api/app.js`.
- [ ] **Step 3: Commit** `git commit -m "Delete the agency dashboard; the Studio draws the company"`

### Task 8: Prove it on staging and record it

**Files:**
- Modify (vetta-mono): `development/memory/progress.md` (status, surprises), `development/memory/decisions.md` (ADR-1766 consequences: what staging showed), `development/memory/canonical-spec.md` only if a contract moved (none planned)

- [ ] **Step 1:** Apply the security template to a staging org (`naive up`); confirm four apps appear under Apps in the Studio rail, each opening signed in.
- [ ] **Step 2:** Add a lead on the landing page; run the sales seat; confirm the lead is in the CRM and `filed` on the site.
- [ ] **Step 3:** Move the client to won, press Onboard; confirm the CEO chat opens drafted, shows one `agents_create` card per seat, grants the identity (if the CEO's catalogue lacks the grant route `POST /v1/agents/:id/identities`, stop and report — that is a platform gap, not an app fix), and `crm.record_onboarding` marks the client active; press Onboard again and confirm no duplicate seat.
- [ ] **Step 4:** Run `customer-tester--<slug>` once against the client's test site; confirm its browser refuses a domain outside the client's.
- [ ] **Step 5: Commit** memory updates; open the agency PR and the vetta-mono PR only when the owner asks.

---

**Next plan (vetta-mono, spec change): the app catalogue.** The Studio's store today only has briefs the CEO builds from scratch (`apps/web/app/lib/app-store.ts`). Prebuilt primitives need: their source published once as catalogue entries (as template app source is, ADR-1483), a store action that installs one into a company as a hosted app (its own row, data and read key, no template), and a template's `apps` naming catalogue ids instead of carrying the source. Then the primitives move out of the agency repo into their own, so media or any template can pick `crm`.

**Out of this plan:** the `calendar` app (owns scheduled slots; its own plan once the four ship), reconciling with the platform's legacy `ads` mini app (ADR-1391), an ad-planning seat for templates whose Ads app is empty.
