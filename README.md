# Agency — an agency in a repo, on the Naive platform

An open-source blueprint: a complete agency you can clone and run under your own
account. It ships a management dashboard (CRM pipeline + agency agents +
per-client workspaces), an MCP server that lets any outside agent operate the
agency, and a public agency website template you personalize to your company in
one file.

It comes in **two templates**: `blank`, a working agency with no specialism, and
`seo-geo`, the same agency specialised in search and answer-engine work. One
repo carries both — see [Templates](#templates).

## Quickstart

You need two credentials: your platform API key, and a dashboard access token
you generate yourself.

```sh
git clone <this repo> my-agency && cd my-agency
naive claim --key sk_...            # bind this clone to your organization
export DASHBOARD_TOKEN=$(openssl rand -hex 32)   # the dashboard's own front door
naive up                            # provision everything declared in naive.config.ts
```

Keep `DASHBOARD_TOKEN` — the dashboard asks for it the first time you open the
deployed URL. It is what stands between a public URL and your CRM: client names,
domains, contacts and their email addresses, your agents and their instructions,
and a content queue anyone could otherwise mark published. `naive.config.ts`
declares it `{ from_env }`, so an unset variable refuses the apply by name
rather than deploying an open dashboard, and the server itself answers
`503 not configured — set DASHBOARD_TOKEN` on every `/api/*` route if it ever
arrives without one. Rotate it by exporting a new value and re-running
`naive up`; the next page load asks again.

`naive up` is idempotent — every resource is keyed by its name in
`naive.config.ts`, so re-running it is always safe.

## What gets provisioned

- **The dashboard app** (`dashboard`, fullstack) — this repo's built UI plus a
  thin server that talks to the platform on your behalf.
- **The public site** (`site`, frontend-only) — the agency marketing website,
  built from `site/`. Its contact form posts to the dashboard's `POST
  /api/leads`, which is the CRM's own route and now behind `DASHBOARD_TOKEN`
  like every other one — so on the deployment, where the two apps are separate
  origins anyway, the form shows its direct-email fallback. Opening a lead
  route to the public web is a decision to make deliberately, with its own rate
  limit and spam handling; this blueprint does not make it for you.
- **Two agency agents** — the active template's, each with a system prompt, a
  scoped tool policy and a daily budget:
  - `sales` — works the CRM pipeline: researches leads, drafts outreach and
    proposals. Never sends anything without your approval.
  - `client-manager` — onboards graduating clients, watches deliverables
    against the calendar, flags stalls before the client notices. Carries a
    Monday-morning schedule that reviews every active client's calendar and
    drafts the week's plan for you.

A template may also declare a **per-client crew**, provisioned by the dashboard
server when you onboard a client — their names carry the client's slug, so they
are per-client resources and cannot be declared in `naive.config.ts`. `seo-geo`
declares three (`seo-writer--<slug>`, `geo-optimizer--<slug>`,
`audit-runner--<slug>`); `blank` declares none and runs every client through the
agency's own pair.

## Templates

A **blueprint** is the machine, and it is shared: the screens, `/api/*`, `/mcp`,
the store, the operator token, the build and deploy, the approval flow. A
**template** is data: the agents and their prompts, their tool allow-lists, the
deliverable kinds, the schedules, the demo seed, the words the screens print.

| Template | The agency it runs | Deliverable kinds | Per-client crew |
|---|---|---|---|
| `blank` | No specialism — sales and a client manager | post, page, report, audit | none |
| `seo-geo` | Search: audits, SERP work, answer-engine optimization | article, landing page, answer block, SERP report, audit | seo-writer, geo-optimizer, audit-runner |

This repo carries **both**, so switching is an edit and a re-apply — never a
re-clone, and never a new app:

```sh
# templates/index.ts
export const TEMPLATE: TemplateName = "blank";   # was "seo-geo"
pnpm build && naive up
```

**Switching widens, and never narrows.** Agents the new template declares are
created. Agents only the old one declared are *reported* and left standing —
`naive up` lists them, and the dashboard lists any per-client crew it did not
provision on that client's Agents tab. Nothing is deleted by a switch: deleting
an agent takes an explicit `removed:` tombstone in `naive.config.ts`. Your own
rows are never touched — clients, deliverables, connections, the app, its URL
and its MCP token all survive a switch, and a deliverable filed under the old
template keeps its kind.

The dashboard shows which template is active on **Settings**, and does not offer
a switcher: a template is data compiled into the app *and* its config, so
switching is the edit above plus a re-apply, and a button could not honestly do
it.

## Operating the agency

| Screen | What it does |
|---|---|
| CRM | Pipeline board (lead → proposal → active → churned), contacts, notes, advance-stage, and **Add a client** — the first one included |
| Approvals | Every agent that has stopped for your approval, the call it wants to make, and the arguments it proposed. Approve or reject each one, with a reason |
| Agents | Every agent in the organization, read from the platform: its budget, what it has spent this period, its sessions and why each one stopped — plus chat with the client-manager |
| Clients | Active clients; each opens a workspace with Overview · Connections · Calendar · Agents · Posts |
| Settings | Platform wiring, and MCP access tokens on a local server |

Nothing publishes without you, and it is the tool policy that says so rather
than the prompts: no agency agent is granted a tool that can publish — not the
dashboard's `approve_post`, and not the platform's `social.post`. They file
posts as *pending*, and only the client's Posts tab moves them onward — from
inside the draft, not from the row, because a deliverable approved off one
truncated line is a deliverable nobody read.

An agent's outward *connection* tools work the same way from the other side:
they are granted, and held at `ask`. The call stops the turn and appears on
**Approvals** with its arguments, so the agent may compose the email and may
not send it without you.

## Run modes

- **Local** — `NAIVE_API_KEY=sk_... pnpm serve` (dashboard on :8789, after
  `pnpm build`), and `pnpm dev` beside it for the hot-reloading UI: the dev
  server proxies `/api` and `/mcp` to :8789, so the screens read the same
  routes the deployment serves. CRM, calendar and queue state persist in a JSON
  file under `data/`, seeded on first run from the active template's demo rows
  — that demo agency is the local file store's, and it is the only place it
  exists.
  Optional: `NAIVE_API_URL` (defaults to the hosted platform),
  `NAIVE_IDENTITY_ID` (routes connection calls through that identity), `PORT`,
  and `DASHBOARD_TOKEN` — unset, a local server leaves `/api/*` open so
  development needs no token; set, it is enforced here exactly as on the deploy.
  The bypass is keyed to the local server process, never to anything a caller
  can send, so it cannot be claimed from outside.
- **Deployed** — `naive up`. The dashboard ships as static files plus one
  function (`dist/api/app.js`) that answers `/mcp` and every `/api/*` route
  from the app database the platform provisions. `naive.config.ts` declares
  `NAIVE_API_KEY` on the app, so the deployed process has the same key you ran
  `naive up` with; the browser never sees it. Every `/api/*` route requires
  `Authorization: Bearer $DASHBOARD_TOKEN`; the dashboard asks for the token
  once and keeps it for the browser tab. `/mcp` is unaffected — agents carry
  their own bearer, which is not yours and does not open `/api/*`.

**A fresh deployment is empty, and that is correct.** The CRM, the calendar and
the queue start with nothing in them, and fill with what you and your agents
put there. No screen has a sample row compiled into it: a template's demo
rows reach a screen only over HTTP, only from a local `pnpm serve`, and a test
fails the build if one ever reaches the bundle.

Without a key the deployment still runs: the CRM and the content queue are the
app's own database, so they work, while the agency chat, the agent roster and
the connections say *not configured — set `NAIVE_API_KEY`* in the screen that
asked for them. Anything else that fails says so where you asked for it, rather
than showing you rows that are not yours.

`pnpm test` runs the suite; `pnpm typecheck` checks both apps.

## The MCP server

The dashboard server exposes the whole agency to outside agents over MCP
(streamable HTTP, JSON-RPC over `POST /mcp`).

1. **Mint a token** on the Settings screen of a local `pnpm serve`
   (Settings → MCP access → mint). The token is shown once; only its hash is
   stored. Revoke from the same screen. Your platform API key is never accepted
   at `/mcp`.
2. **Point a client at it** — endpoint `http://<host>:8789/mcp`, header
   `Authorization: Bearer mcp_...`.

Minting is unauthenticated — the dashboard has no user login — so the three
token routes exist **only** on a local server. On the deployment they answer
`404`, and Settings says so: the platform mints that app's token itself and
injects it, so the agents in your project already reach `/mcp` without one
being handed to whoever finds the URL.

Tools: `list_clients`, `get_client`, `create_lead`, `advance_pipeline`,
`list_posts`, `create_draft_post`, `approve_post`, `schedule_post`,
`list_agents`, `start_agent_session`, `get_calendar`.

## Agents and the CRM

The agency's own agents use the same MCP server, with no per-agent wiring.
The dashboard app declares its endpoint in `naive.config.ts` (`mcp: "/mcp"`);
on `naive up` the platform mints a bearer token for it, injects it into the
app as the `VETTA_MCP_TOKEN` secret, and from then on every agent in the
project is offered the dashboard's tools on every turn as `dashboard.<tool>`
(`dashboard.create_lead`, `dashboard.get_calendar`, …). The agents' tool
policies are deny-by-default, so each one names the CRM tools it works with;
neither gets `approve_post` or `start_agent_session` — approving and spending
stay with you. Nor does either hold the platform's `social.post`.

The client's **connected accounts** reach an agent the same way, as
`<connector>.<tool>` — one namespaced name per operation, because
deny-by-default means a connection nobody named is a connection nobody can
use. The agency pair reads a connected mailbox (`gmail.fetch_emails`) and may
send from it only through you (`gmail.send_email`, `ask`); the `seo-geo` crew
reads the client's own search and analytics accounts and writes to neither.
Add your own by naming them in `templates/*.ts`: reads `allow`, and anything
that sends, posts or deletes `ask`.

Outside clients keep using tokens minted from a local server's Settings screen.
The platform token is never shown in the dashboard and cannot be revoked
from it; drop `mcp` from the config and run `naive up` to retire it.

## Personalize the site

All site copy and branding lives in one file: `site/site.config.ts` (company
name, tone, palette, process, pricing, contact). What the agency *does* — the
hero, the services, the footer line — comes from the active template, so the
public site sells the specialism the dashboard runs and switching template
changes both. Edit either — or paste this prompt into an agent session and let
the agent do it.

The Work and Testimonials sections ship **empty**, and the page says so
("No case studies published yet."). That is deliberate: a case study is a
factual claim about someone else's business and a testimonial is words in a
named person's mouth, so the template carries neither. Fill them only with
engagements you actually ran and quotes a real client actually gave you.

```text
Personalize the agency website in this repo to my company.

Company: <name> — <one-line description>
Audience: <who we sell to>
Tone: <e.g. plainspoken and technical / warm and premium>
Services to emphasize: <e.g. GEO for AI answers, technical SEO, content>

1. Rewrite site/site.config.ts so every field it owns — company name, tone,
   palette, process, pricing tiers, contact — reflects my company. The hero, the
   services and the footer line come from the active template's `site` block in
   templates/index.ts; edit that template, not the site config, for those. Keep
   every exported shape and type exactly as it is.
2. caseStudies.items and testimonials.items: fill them ONLY from what I paste
   below, copying the client names, numbers and quotes exactly as I wrote them.
   Invent nothing — no client, no engagement, no metric, no quote, no
   attribution, and nothing made up to look real. If I left a list blank, leave
   that array empty; the site already tells visitors there are none yet, and
   that is the correct state until I have some.
   My real engagements (client, problem, what we did, measured result):
     <paste, or leave blank>
   My real client quotes (exact words, name, role, and I have their permission):
     <paste, or leave blank>
3. Run `pnpm site:typecheck` and `pnpm site:build` and fix anything red.

Do not touch any other file. When done, list what changed, and list separately
anything you could not fill because I gave you nothing real for it.
```

Then redeploy:

```sh
pnpm build && naive up
```

## Updating the deployment

The deployment is declared, not clicked together. To change agents, budgets,
tool policies, schedules, or either app, edit `naive.config.ts` (and/or the
code), rebuild, and run `naive up` again — it reports each resource as
`created | updated | unchanged | deleted | refused`, and only ships an app
when its build output actually changed. To delete a resource, move its name
into the config's `removed` block (e.g. `removed: { agents: ["sales"] }`)
and run `naive up`; nothing is deleted just by dropping a declaration.

The config can declare more than this template uses:

| Key | What it provisions |
|---|---|
| `blueprint` / `template` | which machine, and which data fills it (`agency` / `blank` \| `seo-geo`) |
| `templates[]` | every template this repo carries; the chosen one's agents become the project's crew, the others' become `kept` |
| `apps[]` | `name`, `type`, `description`, `deploy_dir`, `mcp` (the app's own MCP endpoint path, fullstack only) and `env` — literals or `{ from_env }` written as the app's secrets |
| `agents[]` | `model`, `budget`, `system`, `tools`, `skills`, `mcp_servers`, `allowed_apps`, `identity`, `schedules` |
| `agents[].schedules[]` | cron deployments, owned as a complete set per agent and matched by `cron` |
| `skills[]` | markdown files pushed by slug, versioned by content |
| `identities[]` | personas agents and schedules act as |
| `vaults[]` | credential vaults; values are `{ from_env }` only and reconciled by presence |
| `removed` | `apps`, `agents`, `skills`, `identities`, `vaults` to delete by name |
| `kept` | agent names a template switch widened over — reported, never written, never deleted |

See the `naive` CLI reference in the platform docs for the reconciliation
rules behind each key.

## License

License to be determined before public release; all rights reserved until a
LICENSE file is added.
