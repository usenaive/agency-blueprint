/**
 * `recruiting` — the same agency, specialised in recruiting: role briefs, sourced shortlists,
 * screening and candidate outreach for each client's open roles, with a three-agent team per client.
 *
 * Like `market-research` it is a **delta on `blank`** (`specialise`): the seven keep their model,
 * budget, timers, intakes and allow-lists. Every deliverable it files is the CRM's, on the client.
 *
 * The people in a shortlist are real and did not ask to be in it, so every seat repeats the same
 * limits: public professional pages only, no protected characteristic recorded or inferred, and no
 * message to a candidate that the operator has not approved and sent.
 */
import type { AgentDecl } from "@usenaive-sdk/blueprints";
import type { Client } from "../seed/clients.ts";
import type { Post } from "../seed/posts.ts";
import { AGENCY_IDENTITY, blank, budget, crm, gate, HANDOFF, model, OPERATOR, questions, specialise, tools, type AgencyTemplate } from "./blank.ts";
import { VOCABULARY } from "./index.ts";

/** The limits every seat that reads about a candidate repeats, because the candidates are real people. */
const FAIR =
  "Read public professional pages only — profiles, company pages, talks, repos, articles — never a personal email, phone or address and never a page behind a login. Never record or infer age, gender, race, religion, health, family status or any other protected characteristic, and never invent a person, a title or a skill.";

const FOCUS: Record<string, string> = {
  "site-builder":
    "This agency recruits: the services section names sourcing, screening and outreach; the FAQ says how candidates are found, that every message is approved before it is sent, and that fees are agreed per role.",
  sales:
    "This agency recruits: open each lead with one open role on the prospect's own careers page, and file the role and its link with the note.",
  "client-manager":
    "The deliverables here are role briefs, shortlists, interview kits and outreach sequences; keep each client's open roles moving and each client's team pointed at the next one.",
  "content-writer":
    "Write each post about one question a hiring manager asks, filed as kind article; name no candidate and no client you were not given.",
  "content-reviser":
    "Weak here means: hiring advice with no worked example, a figure with no source, or a claim about a market the post never supports.",
  "gap-researcher":
    "Compare the agency against rival recruiting firms: the roles they say they fill, how they show their process, and what they charge for.",
  "proposal-writer":
    "Tiers are scoped in roles worked at once and the stages included — sourcing, screening, outreach; a proposal never promises a hire or a time to hire.",
};

const SKILLS: Record<string, string[]> = {
  sales: ["naive/recruiting-outreach"],
  "client-manager": ["naive/candidate-screening"],
};

const WORK: Record<string, string> = {
  sales:
    "In this agency every cold opener (not the personal notes to people the operator knows) names one role the prospect is hiring for now, read on its own careers page with web_fetch, and what the agency would do about it. " +
    "File the role and its link as a note on the lead with add_client_note before drafting. Never claim a candidate you do not have.",
};

/** The gate for an agent that works inside one client's account rather than the agency's. */
const clientGate =
  `You work for a recruiting agency on one client's account. ${gate} ` +
  "The client is the CRM row your name ends in (list_clients, get_client); its notes hold the open roles, the pay ranges and what the client has said no to. File every deliverable as a pending draft on that client with create_draft_post, in full, and read list_posts first so you do not file what is already queued. " +
  `You contact no one: every message is a draft the operator approves and sends. ${FAIR}`;

const crewTools = (handoff: boolean) =>
  tools(["web_search", "web_fetch", ...crm("list_clients", "get_client", "list_posts", "create_draft_post"), ...(handoff ? HANDOFF : [])], OPERATOR);

/**
 * The per-client team, a chain: the sourcer writes the role brief and the shortlist and hands the
 * shortlist's `post_` id to the screener, whose interview kit's `post_` id goes to the outreach writer.
 */
const crew: AgentDecl[] = [
  {
    name: "sourcer",
    role: "Sourcer",
    model,
    budget,
    description: "Turns the client's open role into a brief, then finds the people who already do that work.",
    system: `${clientGate} You are the sourcer: read the client's notes and the role's own page, then file one role-brief draft — must-haves, nice-to-haves, pay as given or "not given", who the client has ruled out, and where such people work now — marking which lines are your reading of the notes. Then search public professional pages and file one shortlist draft of eight to fifteen real people, each with the must-haves they show, the link you read, and what you could not confirm, ordered by fit. Hand the shortlist's post_ id to this client's screener with send_to_agent (wait false) — list_agents names the one seat you may reach.`,
    tools: crewTools(true),
    skills: ["naive/candidate-sourcing"],
    handoffs: ["screener"],
    identity: AGENCY_IDENTITY,
  },
  {
    name: "screener",
    role: "Screener",
    model,
    budget,
    description: "Scores the shortlist against the brief, the same way for everyone, and writes the interview kit.",
    system: `${clientGate} You are the screener. A session opened by the sourcer names a post_ id: read that shortlist and the role brief with list_posts first. Score every person against each must-have — shown, partly or not seen, with the evidence — the same way for everyone, and keep anyone you would not put forward on the list with the reason. File one interview-kit draft: one question per must-have about a real past situation with what a good answer shows, the scorecard, the scores, and one open question per candidate. Write no verdict; the client decides. Hand the kit's post_ id to this client's outreach writer with send_to_agent (wait false) — list_agents names the one seat you may reach.`,
    tools: crewTools(true),
    skills: ["naive/candidate-screening"],
    handoffs: ["outreach-writer"],
    identity: AGENCY_IDENTITY,
  },
  {
    name: "outreach-writer",
    role: "Outreach writer",
    model,
    budget,
    description: "Drafts a first message and two follow-ups for each person the screener put forward.",
    system: `${clientGate} You are the outreach writer. A session opened by the screener names a post_ id: read that interview kit and the shortlist with list_posts first. For each person put forward, write a first message naming one specific thing from their own public work, the role in one line, the pay range if the brief gives one and one easy ask, then two shorter follow-ups — each under 120 words, none reused with only the name changed. File them as one outreach-sequence draft for the operator to approve and send. Never misstate the role, the level, the pay or who the client is.`,
    tools: crewTools(false),
    skills: ["naive/recruiting-outreach"],
    handoffs: false,
    identity: AGENCY_IDENTITY,
  },
];

const clients: Client[] = [
  {
    id: "cli_rc01", slug: "ledgerly", name: "Ledgerly", domain: "ledgerly.example", stage: "active",
    services: ["Sourcing", "Screening", "Outreach"],
    contact: { name: "Sample Contact", email: "contact@ledgerly.example", role: "Head of people" },
    notes: ["Demo row — role: senior backend engineer, payments; remote within US time zones; pay range given.", "Has said no to agency-hopping profiles under a year per role."],
    nextAction: "Review the shortlist (Wed)",
  },
  {
    id: "cli_rc02", slug: "greenhaus-clinics", name: "Greenhaus Clinics", domain: "greenhausclinics.example", stage: "active",
    services: ["Sourcing", "Outreach"],
    contact: { name: "Sample Contact", email: "contact@greenhausclinics.example", role: "COO" },
    notes: ["Demo row — role: clinic operations manager, two sites in Denver."],
    nextAction: "Approve the outreach sequence",
  },
  {
    id: "cli_rc03", slug: "fathom-robotics", name: "Fathom Robotics", domain: "fathomrobotics.example", stage: "active",
    services: ["Screening"],
    contact: { name: "Sample Contact", email: "contact@fathomrobotics.example", role: "VP engineering" },
    notes: ["Demo row — screening only: they source, we score and write the interview kit."],
    nextAction: "Agree the scorecard",
  },
  {
    id: "cli_rc04", slug: "marlow-studio", name: "Marlow Studio", domain: "marlowstudio.example", stage: "proposal",
    services: ["Sourcing"],
    contact: { name: "Sample Contact", email: "contact@marlowstudio.example", role: "Founder" },
    notes: ["Demo row — proposal sent: two design roles at once, sourcing and screening."],
    nextAction: "Follow up on the proposal",
  },
  {
    id: "cli_rc05", slug: "pinecrest-logistics", name: "Pinecrest Logistics", domain: "pinecrestlogistics.example", stage: "lead",
    services: [],
    contact: { name: "Sample Contact", email: "contact@pinecrestlogistics.example", role: "HR director" },
    notes: ["Demo row — inbound from the site's contact form; hiring six dispatchers."],
    nextAction: "Book an intake call",
  },
  {
    id: "cli_rc06", slug: "oriole-books", name: "Oriole Books", domain: "oriolebooks.example", stage: "churned",
    services: ["Sourcing"],
    contact: { name: "Sample Contact", email: "contact@oriolebooks.example", role: "Publisher" },
    notes: ["Demo row — one editor search, filled in the spring."],
  },
];

const posts: Post[] = [
  { id: "post_rc101", clientId: "cli_rc01", title: "Role brief: senior backend engineer, payments", summary: "Demo row — five must-haves, pay as given, three lines marked as our reading.", kind: "role-brief", channel: "blog", status: "approved", agent: "sourcer--ledgerly", scheduledFor: "2026-11-02", hue: 210 },
  { id: "post_rc102", clientId: "cli_rc01", title: "Shortlist: 12 payments engineers", summary: "Demo row — each with the must-haves shown and the public page read.", kind: "shortlist", channel: "blog", status: "pending", agent: "sourcer--ledgerly", scheduledFor: "2026-11-04", hue: 230 },
  { id: "post_rc103", clientId: "cli_rc01", title: "Interview kit and scores", summary: "Demo row — five questions, a 1–4 scorecard, one open question per candidate.", kind: "interview-kit", channel: "blog", status: "ready", agent: "screener--ledgerly", scheduledFor: "2026-11-05", hue: 260 },
  { id: "post_rc201", clientId: "cli_rc02", title: "Outreach: clinic operations managers", summary: "Demo row — a first note and two follow-ups for seven people.", kind: "outreach-sequence", channel: "blog", status: "pending", agent: "outreach-writer--greenhaus-clinics", scheduledFor: "2026-11-03", hue: 140 },
  { id: "post_rc202", clientId: "cli_rc02", title: "Shortlist: Denver clinic operations", summary: "Demo row — nine people, ordered by fit to the brief.", kind: "shortlist", channel: "blog", status: "posted", agent: "sourcer--greenhaus-clinics", scheduledFor: "2026-10-22", postedAt: "6d ago", hue: 120 },
  { id: "post_rc203", clientId: "cli_rc02", title: "Outreach that reused one message", summary: "Demo row — rejected so you can see what that looks like.", kind: "outreach-sequence", channel: "blog", status: "rejected", agent: "outreach-writer--greenhaus-clinics", scheduledFor: "2026-10-27", rejectedReason: "Demo row — the same opener for every person, only the name changed.", hue: 0 },
  { id: "post_rc301", clientId: "cli_rc03", title: "Interview kit: robotics test engineer", summary: "Demo row — the same six questions for every candidate the client sourced.", kind: "interview-kit", channel: "blog", status: "pending", agent: "screener--fathom-robotics", scheduledFor: "2026-11-06", hue: 30 },
];

export const recruiting: AgencyTemplate = {
  ...blank,
  name: "recruiting",
  title: "Recruiting agency",
  description: VOCABULARY.recruiting.description,
  roadmap: { day_one: "Set up your site, pipeline and first open roles" },
  kinds: VOCABULARY.recruiting.kinds,
  words: { ...VOCABULARY.recruiting.words },
  seed: { clients, posts },
  questions: [
    {
      key: "offer",
      type: "text",
      label: "What roles does your agency fill, and for whom?",
      help: questions[0]!.help,
      placeholder: "Senior engineering and product roles for Series A–C fintech startups.",
    },
    questions[1]!,
    questions[2]!,
    {
      key: "markets",
      type: "text",
      label: "Which locations and levels do you recruit for, and how do you charge?",
      help: "The team writes every role brief from this, and the site's services are written from it.",
      placeholder: "US remote and New York; senior and staff; a fee per hire agreed per role.",
    },
    // No network question: four is the limit. sales asks for the operator's network in its first session.
  ],
  crew,
  agents: specialise(blank.agents, { focus: FOCUS, skills: SKILLS, work: WORK }),
};
