/**
 * `blank` — a working agency with no specialism, and the base every other template of this
 * blueprint is a delta on.
 *
 * Everything here is data: the seven-agent crew of `templates/agents.ts` with generic prompts,
 * generic deliverable kinds, the three setup questions whose answers the crew reads first, and a
 * demo seed that is plainly a demo. There is no per-client crew: this agency runs every client
 * through its own seven, which is a complete agency and the safe thing to get by accident
 * (`BLUEPRINTS.agency.default`).
 *
 * The demo rows live in this module and never reach the browser bundle (`src/no-seed.test.ts`): a
 * deployed dashboard that showed them would be presenting fiction as the operator's own CRM. The
 * screens' half of the template — kinds, words, site copy — is `templates/index.ts`.
 */
import type { AgentDecl, DefineInput, Template } from "@usenaive-sdk/blueprints";
import type { Client } from "../seed/clients.ts";
import type { Post } from "../seed/posts.ts";
import { roster } from "./agents.ts";
import { VOCABULARY } from "./index.ts";

export {
  AGENCY_IDENTITY, AGENCY_TIMEZONE, ASK_OPERATOR, budget, CONTEXT, crm, gate, mailbox, MAILBOX_READ, MAILBOX_SEND,
  model, OPERATOR, OWN_RECORD, PREAMBLE, REQUEST_TOOLS, roster, tools,
} from "./agents.ts";

/**
 * The blueprint's `Template` plus what a project-level declaration cannot hold: the ≤3 setup
 * questions this template asks (`defineProject({ questions })`, §7.1 — the engine refuses a fourth),
 * and the crew provisioned per client at onboarding, whose names carry the client's slug and so
 * cannot be declared statically. `server/proxy.ts` posts `crew` as it stands, with the slug appended
 * to each `name`; `naive.config.ts` publishes its `{name, role, description}` as `crew_per_client`.
 */
export interface AgencyTemplate extends Template {
  questions: NonNullable<DefineInput["questions"]>;
  crew: AgentDecl[];
}

/**
 * The three questions the studio asks before anything is provisioned (plan §4). Their answers are
 * the project context every agent reads first; `help` says which agent reads which, so the person
 * answering knows what the answer buys.
 */
export const questions: AgencyTemplate["questions"] = [
  {
    key: "offer",
    type: "text",
    label: "What does your agency sell, and to whom?",
    help: "One or two sentences. The site-builder writes the hero from this; sales and the writers read it before every session.",
    placeholder: "Paid social and landing pages for DTC skincare brands doing $1–10M.",
  },
  {
    key: "ideal_client",
    type: "text",
    label: "Who is your ideal client — industry, size, geography?",
    help: "Sales builds its first prospect list from this on day one.",
    placeholder: "US and UK skincare brands, 5–50 staff, running paid social already.",
  },
  {
    key: "pricing",
    type: "text",
    label: "How do you price — retainer / project / hourly — and your typical range?",
    help: "Shapes the pricing section of the site and the proposal skeleton.",
    placeholder: "Monthly retainer, $4k–$12k, three-month minimum.",
  },
];

const clients: Client[] = [
  {
    id: "cli_dm01", slug: "demo-hardware", name: "Demo Hardware Co", domain: "demo-hardware.example", stage: "active",
    services: ["Strategy", "Content"],
    contact: { name: "Sample Contact", email: "contact@demo-hardware.example", role: "Owner" },
    notes: ["Demo row — replace it with a client of your own.", "Wants one post a week and a monthly report."],
    nextAction: "Send the quarter's calendar for sign-off",
  },
  {
    id: "cli_dm02", slug: "demo-clinic", name: "Demo Clinic", domain: "demo-clinic.example", stage: "active",
    services: ["Content", "Reporting"],
    contact: { name: "Sample Contact", email: "contact@demo-clinic.example", role: "Practice manager" },
    notes: ["Demo row — replace it with a client of your own."],
    nextAction: "Review last month's report together",
  },
  {
    id: "cli_dm03", slug: "demo-studio", name: "Demo Studio", domain: "demo-studio.example", stage: "proposal",
    services: ["Strategy"],
    contact: { name: "Sample Contact", email: "contact@demo-studio.example", role: "Founder" },
    notes: ["Demo row — proposal sent, waiting on a reply."],
    nextAction: "Follow up on the proposal",
  },
  {
    id: "cli_dm04", slug: "demo-outfitters", name: "Demo Outfitters", domain: "demo-outfitters.example", stage: "lead",
    services: [],
    contact: { name: "Sample Contact", email: "contact@demo-outfitters.example", role: "Marketing lead" },
    notes: ["Demo row — inbound from the site's contact form."],
    nextAction: "Book a discovery call",
  },
  {
    id: "cli_dm05", slug: "demo-realty", name: "Demo Realty", domain: "demo-realty.example", stage: "churned",
    services: ["Content"],
    contact: { name: "Sample Contact", email: "contact@demo-realty.example", role: "Broker" },
    notes: ["Demo row — paused after four months."],
  },
];

const posts: Post[] = [
  { id: "post_dm101", clientId: "cli_dm01", title: "What to look for in a first workshop kit", summary: "Demo row — a buyer's-guide post for the blog.", kind: "post", channel: "blog", status: "pending", agent: "client-manager", scheduledFor: "2025-03-04", hue: 210 },
  { id: "post_dm102", clientId: "cli_dm01", title: "Workbench service page", summary: "Demo row — a service page with the booking call to action.", kind: "page", channel: "blog", status: "ready", agent: "client-manager", scheduledFor: "2025-03-07", hue: 160 },
  { id: "post_dm103", clientId: "cli_dm01", title: "February report", summary: "Demo row — what shipped last month and what it moved.", kind: "report", channel: "blog", status: "posted", agent: "client-manager", scheduledFor: "2025-03-01", postedAt: "2d ago", clicks: 312, impressions: 9_840, hue: 30 },
  { id: "post_dm104", clientId: "cli_dm01", title: "Site and channel audit", summary: "Demo row — the quarterly sweep, ordered by impact.", kind: "audit", channel: "blog", status: "approved", agent: "client-manager", scheduledFor: "2025-03-12", hue: 280 },
  { id: "post_dm201", clientId: "cli_dm02", title: "Five questions before a first appointment", summary: "Demo row — a plain-language explainer post.", kind: "post", channel: "blog", status: "pending", agent: "client-manager", scheduledFor: "2025-03-05", hue: 340 },
  { id: "post_dm202", clientId: "cli_dm02", title: "New-patient landing page", summary: "Demo row — one page for one intent.", kind: "page", channel: "blog", status: "approved", agent: "client-manager", scheduledFor: "2025-03-14", hue: 120 },
  { id: "post_dm203", clientId: "cli_dm02", title: "LinkedIn: what we learned this quarter", summary: "Demo row — repurposed from the explainer.", kind: "post", channel: "linkedin", status: "rejected", agent: "client-manager", scheduledFor: "2025-03-10", rejectedReason: "Demo row — rejected so you can see what that looks like.", hue: 0 },
  { id: "post_dm204", clientId: "cli_dm02", title: "February report", summary: "Demo row — the month, in one page.", kind: "report", channel: "blog", status: "posted", agent: "client-manager", scheduledFor: "2025-03-02", postedAt: "5d ago", clicks: 54, impressions: 1_120, hue: 180 },
];

export const blank: AgencyTemplate = {
  name: "blank",
  description: VOCABULARY.blank.description,
  kinds: VOCABULARY.blank.kinds,
  words: { ...VOCABULARY.blank.words },
  seed: { clients, posts },
  questions,
  crew: [],
  agents: roster,
};
