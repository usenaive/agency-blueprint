/**
 * `security` — a product QA and red-team agency: per client, browser agents use the client's live
 * product the way a real customer would, then push on its edges, and every gap they find is filed
 * with its steps, what was expected and what happened.
 *
 * Like `market-research` it is a **delta on `blank`** (`specialise`): the seven keep their model,
 * budget, timers and allow-lists, and this file adds a focus, the words, the kinds of work, the
 * fourth question, a two-seat crew and the demo seed.
 *
 * The crew works in production, so its limits are structural, not only in prompts: its one
 * `browser` is allow-listed to the client's own domain, filled in per client at onboarding
 * (`CLIENT_DOMAIN`, `server/proxy.ts`), and a signup pauses for the operator, so every test
 * account is one a person approved. The prompts add the rest: test accounts only, nothing paid,
 * deleted or sent to a real person, and no load.
 */
import type { AgentDecl } from "@usenaive-sdk/blueprints";
import type { Client } from "../seed/clients.ts";
import type { Post } from "../seed/posts.ts";
import { AGENCY_IDENTITY, blank, budget, crm, CLIENT_DOMAIN, gate, HANDOFF, model, OPERATOR, questions, specialise, tools, type AgencyTemplate } from "./blank.ts";
import { VOCABULARY } from "./index.ts";

/** What every crew seat repeats, because the client's product is live and its users are real. */
const SAFE =
  "This is the client's live product. Use only the test accounts the operator approved (signup pauses for approval; the client's notes name any account to use); never pay, upgrade, delete, invite, or send anything to a real person; never load-test or repeat a request to see what breaks; never read, keep or report another user's data. If you reach real user data or anything that looks like a security hole, stop, file what you saw without the data, and ask_operator.";

const FOCUS: Record<string, string> = {
  "site-builder":
    "This agency tests products: the services section names customer journey testing, edge-case and red-team testing, and retests; the FAQ says testing runs only on products whose owner hired the agency, with test accounts, and never with real payments.",
  sales:
    "This agency sells product testing: open each lead with one concrete thing a first-time customer would notice on the prospect's public homepage, never a claim of having tested their product.",
  "client-manager":
    "The deliverables here are journey reports, gap reports and retests; keep each client's calendar full of them, and after each gap report schedule a retest of what the client says it fixed.",
  "content-writer":
    "Write each post around one question a product team asks about testing in production, filed as kind article.",
  "content-reviser":
    "Weak here means: advice that would have a tester touch real user data or real payments, or a claim with no example.",
  "gap-researcher":
    "Compare the agency against QA, usability-testing and penetration-testing firms: what they publish, what a report from them contains, and what they promise.",
  "proposal-writer":
    "Tiers are scoped in journeys tested per month and retests included, and a proposal never promises a number of bugs or a clean result.",
};

const SKILLS: Record<string, string[]> = {
  "client-manager": ["naive/qa-gap-report"],
};

/** The gate for an agent that works inside one client's account rather than the agency's. */
const clientGate =
  `You work for a product testing agency on one client's account. ${gate} ` +
  "The client is the CRM row your name ends in (list_clients, get_client); its notes say who their customer is, which journeys matter and which test account to use. Your browser reaches only that client's domain. File every deliverable as a pending draft on that client with create_draft_post, in full, and read list_posts first so you do not file what is already queued; add_client_note what the next tester should know. " +
  SAFE;

/**
 * The crew's browser: the client's own domain only, writes allowed (a tester has to fill forms),
 * and `signup` pausing for the operator, which is the platform default named here so a test
 * reading this file sees the rule.
 */
const browser = {
  enabled: true,
  permission: "allow" as const,
  config: { allowed_domains: [CLIENT_DOMAIN], allow_writes: true, ask_actions: ["signup"], timeout_minutes: 30 },
};
const crewTools = (handoff: boolean): AgentDecl["tools"] => {
  const base = tools([...crm("list_clients", "get_client", "list_posts", "create_draft_post", "add_client_note"), ...(handoff ? HANDOFF : [])], OPERATOR)!;
  return { ...base, configs: { ...base.configs, browser } };
};

/**
 * The per-client crew, a chain: the customer tester walks the product as its customer would and
 * hands its journey report's `post_` id to the edge tester, who pushes on the same journey.
 */
const crew: AgentDecl[] = [
  {
    name: "customer-tester",
    role: "Customer tester",
    model,
    budget,
    description: "Uses the client's product the way a new customer would, and reports where it gets hard.",
    system: `${clientGate} You are the customer tester. Become the client's customer as their notes describe them, with that customer's goal, and use the product to reach it: land on the site, work out what it does and what it costs, sign up, get through onboarding, and do the one job the customer came for. Narrate as that customer: where you hesitated, what you misread, what you looked for and could not find, what broke. File one journey-report draft: the goal, each step with what you did and what you saw, every gap with steps to reproduce, and a verdict on whether this customer would stay. When it is filed, hand its post_ id to this client's edge tester with send_to_agent (wait false) — list_agents names the one seat you may reach.`,
    tools: crewTools(true),
    skills: ["naive/customer-journey-testing", "naive/qa-gap-report"],
    handoffs: ["edge-tester"],
    identity: AGENCY_IDENTITY,
  },
  {
    name: "edge-tester",
    role: "Edge-case tester",
    model,
    budget,
    description: "Pushes on the journeys the customer tester walked: odd inputs, odd orders, broken states.",
    system: `${clientGate} You are the edge-case tester, the red team. A session opened by the customer tester names a post_ id: read that journey report with list_posts first, then go back over the same journey and try what a real customer eventually does by accident or on purpose: empty, very long, foreign-script and malformed input; the back button, a refresh or a second tab mid-flow; submitting twice; a link opened logged out; a URL edited to reach another of your own test accounts' records; a phone-sized viewport. File one gap-report draft: every gap with a severity, steps to reproduce, what you expected and what happened, ordered worst first, and a list of what you tried that held. When the client's notes list fixes to check, file a retest draft instead: each earlier gap, retried, marked fixed or still open.`,
    tools: crewTools(false),
    skills: ["naive/edge-case-testing", "naive/qa-gap-report"],
    handoffs: false,
    identity: AGENCY_IDENTITY,
  },
];

const clients: Client[] = [
  {
    id: "cli_sc01", slug: "parcel-loop", name: "Parcel Loop", domain: "parcelloop.example", stage: "active",
    services: ["Journeys", "Edge cases"],
    contact: { name: "Sample Contact", email: "contact@parcelloop.example", role: "CTO" },
    notes: ["Demo row — customer: a small online shop owner booking their first pickup. Journeys: sign up, connect a store, book a pickup.", "Test account on file: qa+1@parcelloop.example. Payments in test mode only."],
    nextAction: "Walk through the gap report (Wed)",
  },
  {
    id: "cli_sc02", slug: "brightwell-clinics", name: "Brightwell Clinics", domain: "brightwellclinics.example", stage: "active",
    services: ["Journeys", "Retests"],
    contact: { name: "Sample Contact", email: "contact@brightwellclinics.example", role: "Operations director" },
    notes: ["Demo row — customer: a patient booking a first appointment on a phone.", "Fixes to check: the date picker and the confirmation email."],
    nextAction: "Send the retest",
  },
  {
    id: "cli_sc03", slug: "tallyhq", name: "TallyHQ", domain: "tallyhq.example", stage: "active",
    services: ["Edge cases"],
    contact: { name: "Sample Contact", email: "contact@tallyhq.example", role: "Head of engineering" },
    notes: ["Demo row — customer: a freelancer sending their first invoice. Two test workspaces on file, so the edge tester can try reaching one from the other."],
    nextAction: "Confirm the test workspaces still exist",
  },
  {
    id: "cli_sc04", slug: "orbit-legal", name: "Orbit Legal", domain: "orbitlegal.example", stage: "proposal",
    services: ["Journeys"],
    contact: { name: "Sample Contact", email: "contact@orbitlegal.example", role: "Managing partner" },
    notes: ["Demo row — proposal sent; waiting on a test account before any testing."],
    nextAction: "Follow up on the proposal",
  },
  {
    id: "cli_sc05", slug: "fieldwork-coffee", name: "Fieldwork Coffee", domain: "fieldworkcoffee.example", stage: "lead",
    services: [],
    contact: { name: "Sample Contact", email: "contact@fieldworkcoffee.example", role: "Founder" },
    notes: ["Demo row — inbound from the site's contact form: subscription checkout drops people."],
    nextAction: "Book a scoping call",
  },
  {
    id: "cli_sc06", slug: "harbor-print", name: "Harbor Print", domain: "harborprint.example", stage: "churned",
    services: ["Journeys"],
    contact: { name: "Sample Contact", email: "contact@harborprint.example", role: "Owner" },
    notes: ["Demo row — one journey test, delivered in the spring."],
  },
];

const posts: Post[] = [
  { id: "post_sc101", clientId: "cli_sc01", title: "First pickup, as a new shop owner", summary: "Demo row — nine steps from the homepage to a booked pickup; stuck twice, at the store connection and the address form.", kind: "journey-report", channel: "blog", status: "approved", agent: "customer-tester--parcel-loop", scheduledFor: "2026-11-02", hue: 160 },
  { id: "post_sc102", clientId: "cli_sc01", title: "Gap report: booking a pickup", summary: "Demo row — eleven gaps, worst first: a double submit books two pickups.", kind: "gap-report", channel: "blog", status: "pending", agent: "edge-tester--parcel-loop", scheduledFor: "2026-11-04", hue: 0 },
  { id: "post_sc201", clientId: "cli_sc02", title: "Retest: date picker and confirmation email", summary: "Demo row — the date picker is fixed; the email still shows the wrong time zone.", kind: "retest", channel: "blog", status: "ready", agent: "edge-tester--brightwell-clinics", scheduledFor: "2026-11-05", hue: 200 },
  { id: "post_sc202", clientId: "cli_sc02", title: "Booking a first appointment on a phone", summary: "Demo row — rejected so you can see what that looks like.", kind: "journey-report", channel: "blog", status: "rejected", agent: "customer-tester--brightwell-clinics", scheduledFor: "2026-10-30", rejectedReason: "Demo row — the steps to reproduce skip the login.", hue: 330 },
  { id: "post_sc301", clientId: "cli_sc03", title: "Gap report: first invoice", summary: "Demo row — one workspace's invoice opened from the other by editing the URL; reported without its contents.", kind: "gap-report", channel: "blog", status: "posted", agent: "edge-tester--tallyhq", scheduledFor: "2026-10-27", postedAt: "2d ago", clicks: 41, impressions: 620, hue: 260 },
];

export const security: AgencyTemplate = {
  ...blank,
  name: "security",
  title: "Security agency",
  description: VOCABULARY.security.description,
  roadmap: { day_one: "Set up your site, pipeline and first tests" },
  kinds: VOCABULARY.security.kinds,
  words: { ...VOCABULARY.security.words },
  seed: { clients, posts },
  questions: [
    {
      key: "offer",
      type: "text",
      label: "What testing does your agency sell, and to whom?",
      help: questions[0]!.help,
      placeholder: "Customer-journey and edge-case testing of live web apps for seed-to-Series-B software companies.",
    },
    questions[1]!,
    questions[2]!,
    {
      key: "products",
      type: "text",
      label: "What kinds of products do your clients ship, and which journeys matter most?",
      help: "The testers plan each client's journeys from this, and the site's services are written from it.",
      placeholder: "Web apps with a self-serve signup; signup, onboarding and the first paid action matter most.",
    },
  ],
  crew,
  agents: specialise(blank.agents, { focus: FOCUS, skills: SKILLS }),
};
