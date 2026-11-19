/**
 * The `agency` blueprint's template, held to what a template is.
 *
 * A template is DATA — agents and prompts, tool allow-lists, deliverable kinds, schedules, the
 * demo seed, the screen vocabulary. The agency carries `blank` alone, which must carry no
 * specialism at all: SEO & GEO and Product design are teams in `crews/` (ADR-3010 in
 * usenaive/vetta-mono), tested in `crews/crews.test.ts`.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Client } from "../seed/clients.ts";
import type { Post } from "../seed/posts.ts";
import { TEMPLATES } from "./active.ts";
import { AGENCY_IDENTITY, AGENCY_TIMEZONE, NOT_A_CONTACT, PREAMBLE } from "./agents.ts";
import { blank } from "./blank.ts";
import { TEMPLATE, VOCABULARY, kindLabel } from "./index.ts";

/** Plan §2.1's roster, name and role, in the order the studio lists them. */
const ROSTER = [
  ["site-builder", "Public site"],
  ["sales", "Pipeline"],
  ["client-manager", "Delivery"],
  ["content-writer", "Content"],
  ["content-reviser", "Revisions"],
  ["gap-researcher", "Research"],
  ["proposal-writer", "Proposals"],
  ["inbox", "Mail"],
];

const all = Object.values(TEMPLATES);
const clientsOf = (t: (typeof all)[number]) => t.seed.clients as Client[];
const postsOf = (t: (typeof all)[number]) => t.seed.posts as Post[];
const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

/** Every string a template puts in front of a person or a model. Skill refs are catalogue slugs, not prose. */
const prose = (t: (typeof all)[number]): string =>
  JSON.stringify([
    t.description,
    t.words,
    t.kinds,
    t.agents.map(({ skills: _, ...agent }) => agent),
    t.crew,
    t.seed,
    t.questions,
    VOCABULARY[t.name as keyof typeof VOCABULARY].site,
  ]);

describe("every template of this blueprint", () => {
  it("carries blank alone: the specialisms are teams a company adds beside it", () => {
    expect(all.map((t) => t.name)).toEqual(["blank"]);
    expect(TEMPLATES[TEMPLATE].name).toBe(TEMPLATE);
  });

  it.each(all)("$name declares the eight that run an agency, with the gate in every prompt", (template) => {
    expect(template.agents.map((a) => [a.name, a.role])).toEqual(ROSTER);
    for (const agent of [...template.agents, ...template.crew]) {
      expect(agent.system).toMatch(/never send or publish anything yourself/);
      expect(agent.model).toBeTruthy();
      expect(agent.tools?.default_config.permission).toBe("deny");
    }
  });

  /**
   * Plan §2.1, held per agent: the shared paragraph first (read `project_context` before anything;
   * the answers are the client's), a two-sentence public description, a private prompt of 150–400
   * words, skills from the platform catalogue only, and a day-one intake capped at $2.
   */
  it.each(all)("$name writes each of the eight to the plan's shape", (template) => {
    for (const agent of template.agents) {
      const at = agent.name;
      // The inbox seat reads no setup answers and no skill (ADR-3134): mail is a stranger's, so it holds nothing else to read.
      const inbox = at === "inbox";
      expect([at, agent.system?.startsWith(PREAMBLE)]).toEqual([at, !inbox]);
      expect([at, agent.description?.match(/[.!?](\s|$)/g)?.length]).toEqual([at, 2]);
      const n = words(agent.system ?? "");
      expect([at, n >= 150 && n <= 400]).toEqual([at, true]);
      expect([at, (agent.skills ?? []).length > 0]).toEqual([at, !inbox]);
      for (const ref of agent.skills ?? []) expect([at, ref]).toEqual([at, expect.stringMatching(/^naive\/[a-z0-9-]+(@\d+)?$/)]);
      expect([at, agent.intake?.budget_micro_usd]).toEqual([at, 20_000_000]);
      for (const schedule of agent.schedules ?? []) expect([at, Number.isInteger(schedule.budget_micro_usd)]).toEqual([at, true]);
    }
  });

  it.each(all)("$name asks the setup questions its deliverables require", (template) => {
    expect(template.questions.map((q) => q.type)).toEqual(["text", "text", "text", "text"]);
    expect(template.questions.map((q) => q.key)).toEqual(["offer", "ideal_client", "pricing", "network"]);
    // Only the network question may be skipped: an agency with no contacts to list still installs.
    expect(template.questions.filter((q) => q.optional).map((q) => q.key)).toEqual(["network"]);
  });

  it.each(all)("$name drafts a personal note to each person the operator knows, and invents none", (template) => {
    const sales = template.agents.find((a) => a.name === "sales")!;
    const intake = sales.intake?.message ?? "";
    // On blank the question is optional: a missing answer is a skip, never a second ask.
    expect(intake).toMatch(/network answer, use it; if it has none and the context's template is blank, the operator skipped that optional setup question: do not ask again, stop there/);
    expect(intake).toMatch(/on any other template, which asks no network question at setup, ask the operator once with ask_operator/);
    expect(intake).toMatch(/crm\.write add \(source network.*a chat of its own that drafts a short personal note on their timeline — do not send/);
    expect(intake).toMatch(/never invent a contact/);
    // Prospects first, network last: asking parks the session, and the list should not wait on it.
    expect(intake.indexOf("fifteen prospects")).toBeLessThan(intake.indexOf("ask_operator"));
    expect(intake).toMatch(/crm\.write add \(stage lead, source outreach/);
    expect(intake).toMatch(/ask for advice or an introduction rather than pitching; never claim a result/);
    // The daily pass gives each reply the inbox seat logged the source it came from.
    const inbox = sales.schedules?.[0]?.input ?? "";
    expect(inbox).toMatch(/source referral when an existing client.*"Referred by <client name> \(<cli_ id>\)".*source network.*otherwise outreach/);
    // A deal that signs becomes a client in the same step, never by a later click.
    expect(sales.system).toMatch(/won and create_client \(ctc_ id as crm_contact\) in the same step/);
    expect(inbox).toMatch(/won and create_client .* in the same step/);
  });

  it.each(all)("$name never sends an agent to a setup answer the template did not ask for", (template) => {
    // A context with no pricing answer (one installed before the question, or a retired template's)
    // sends the site-builder and the proposal-writer to the operator — never to read the absence as
    // "free" or to invent a tier.
    const asked = new Set(template.questions.map((q) => q.key));
    for (const name of ["site-builder", "proposal-writer"]) {
      const agent = template.agents.find((a) => a.name === name)!;
      expect(agent.system, name).toMatch(/pricing answer when the context holds one.*when it does not.*ask_operator/);
    }
    const gap = template.agents.find((a) => a.name === "gap-researcher")!;
    expect((gap.system ?? "").includes("third setup answer")).toBe(asked.has("competitors"));
  });

  // NEW-312: a proposal reads the CRM, after which the computer's file tools are refused (people data), so it is saved
  // straight from its text with publish_file and reaches the person as one file plus one review.
  it.each(all)("$name delivers a proposal as one saved file and one review", (template) => {
    const writer = template.agents.find((a) => a.name === "proposal-writer")!;
    expect(writer.tools?.configs["publish_file"]).toEqual({ enabled: true, permission: "allow" });
    expect(writer.tools?.configs["ask_operator"]).toEqual({ enabled: true, permission: "ask" });
    expect(writer.system).toMatch(/publish_file, its whole text as content.*client:<its ctc_ id> and kind:proposal.*call ask_operator once.*Approve or Changes needed.*One file and one ask per proposal, then stop/);
  });

  // NEW-319: two day-one seats each added the agency itself to the CRM while filing on its own record.
  it.each(all)("$name never makes the agency a CRM contact where it files on its own record", (template) => {
    for (const agent of template.agents) {
      const writesCrm = agent.tools?.configs["crm.write"] !== undefined;
      const ownRecord = /agency's own record/.test(`${agent.system} ${agent.intake?.message ?? ""}`);
      if (writesCrm && ownRecord) expect([agent.name, `${agent.system} ${agent.intake?.message}`]).toEqual([agent.name, expect.stringContaining(NOT_A_CONTACT)]);
    }
  });

  it.each(all)("$name seeds a demo that says it is one, and files only kinds it declares", (template) => {
    const kinds = new Set(template.kinds.map((k) => k.id));
    expect(kinds.size).toBeGreaterThan(0);
    expect(clientsOf(template).length).toBeGreaterThan(0);
    for (const post of postsOf(template)) expect(kinds).toContain(post.kind);
    // A seed row is the template's sample, never a claim about a real company: every demo client
    // is on a reserved `.example` domain and says so in its notes.
    for (const client of clientsOf(template)) {
      expect(client.domain).toMatch(/\.example$/);
      expect(client.contact.email).toMatch(/\.example$/);
      expect(client.notes.join(" ")).toMatch(/[Dd]emo row/);
    }
  });

  it.each(all)("$name only files work for a client it seeded", (template) => {
    const ids = new Set(clientsOf(template).map((c) => c.id));
    for (const post of postsOf(template)) expect(ids).toContain(post.clientId);
  });
});

describe("connected accounts", () => {
  /**
   * Every active connection an agent's identity holds contributes its catalogue to the turn as
   * `<connector>.<tool>`, through the same allow/ask/deny filter as `bash`
   * (`apps/runtime-do/src/connection-tools.ts`). Deny-by-default therefore means a template that
   * names none grants none — which is how a crew sold on reaching a client's connected accounts
   * ended up able to call `web_search` and `web_fetch` and nothing else.
   */
  const connectionTools = (agent: { tools?: { configs: Record<string, { permission: string }> } }) =>
    Object.entries(agent.tools?.configs ?? {}).filter(([name]) => name.includes(".") && !name.startsWith("dashboard.") && !name.startsWith("crm."));

  it.each(all)("$name grants connected accounts only to agents that consume them", (template) => {
    // Only the mail seats: the inbox reads and sends, sales and the client manager only send.
    for (const agent of template.agents) {
      const outward = ["sales", "client-manager", "inbox"].includes(agent.name);
      expect([agent.name, connectionTools(agent).length > 0]).toEqual([agent.name, outward]);
    }
  });

  /**
   * The grant itself. A connection reaches a turn along `session → agent → agent_identity →
   * identity → connected accounts`, so an agent that holds no persona is offered NOTHING from a
   * connected account — the resolver answers an empty list and no screen, log or apply says a word.
   * Every name asserted above was in exactly that state: written, allow-listed, unreachable.
   *
   * The per-client crew is included because it is where the search and analytics names live, and
   * because `POST /v1/agents` has no identity field: `server/proxy.ts` reads this and grants it.
   */
  it.each(all)("$name names the persona on every agent that has one of them", (template) => {
    for (const agent of [...template.agents, ...template.crew]) {
      expect([agent.name, agent.identity]).toEqual([agent.name, AGENCY_IDENTITY]);
    }
  });

  it.each(all)("$name holds every outward one at `ask`, and nothing else outward", (template) => {
    for (const agent of [...template.agents, ...template.crew]) {
      for (const [name, config] of connectionTools(agent)) {
        if (config.permission === "deny") continue;
        const outward = /\.(send|post|publish|create|update|delete|write|reply)/.test(name);
        expect([name, config.permission]).toEqual([name, outward ? "ask" : "allow"]);
      }
    }
  });
});

describe("handoffs", () => {
  /**
   * Day one is ordered by handoffs (canonical-spec §28.12), not by seven intakes racing for one
   * empty record: the researcher files its report and hands it to the writer, sales hands a lead it
   * advanced to the proposal writer. Every other seat holds
   * `handoffs: false`, so the tools are offered to exactly the seats that pass work on.
   */
  const CHAIN: Record<string, string[]> = {
    sales: ["proposal-writer"],
    // The client manager's Monday pass starts a chat of its own seat per client (one chat, one
    // client); a `handoffs` list is what offers it `send_to_agent`, and sales is where an upsell goes.
    "client-manager": ["sales"],
    "gap-researcher": ["content-writer"],
  };
  const handoffTools = (agent: { tools?: { configs: Record<string, { permission: string }> } }) =>
    ["send_to_agent", "list_agents"].filter((name) => agent.tools?.configs[name]?.permission === "allow");

  it.each(all)("$name names the next seat on every seat that hands work on, and closes the rest", (template) => {
    for (const agent of [...template.agents, ...template.crew]) {
      expect([agent.name, agent.handoffs]).toEqual([agent.name, CHAIN[agent.name] ?? false]);
    }
  });

  it.each(all)("$name grants both tools to exactly those seats — a `handoffs` list under deny-by-default offers nothing on its own", (template) => {
    for (const agent of [...template.agents, ...template.crew]) {
      const hands = agent.name in CHAIN;
      expect([agent.name, handoffTools(agent)]).toEqual([agent.name, hands ? ["send_to_agent", "list_agents"] : []]);
    }
  });

  it.each(all)("$name tells each sender what to pass — the durable id the receiver reads first", (template) => {
    const roster = new Map([...template.agents, ...template.crew].map((a) => [a.name, a]));
    for (const [from, [to]] of Object.entries(CHAIN)) {
      const sender = roster.get(from);
      if (sender === undefined) continue; // `blank` provisions no crew
      const receiver = roster.get(to!)!;
      const work = [sender.system, sender.intake?.message, ...(sender.schedules ?? []).map((t) => t.input)].join(" ");
      expect([from, work]).toEqual([from, expect.stringMatching(/send_to_agent[^.]*wait false/)]);
      // A prospect is a platform CRM contact; the agency's own work a dashboard row; a client's account a draft.
      const id = template.crew.some((a) => a.name === from) ? /post_ id/ : ["sales", "client-manager"].includes(from) ? /ctc_ id/ : /cli_ id/;
      expect([from, sender.system]).toEqual([from, expect.stringMatching(id)]);
      expect([to, receiver.system]).toEqual([to, expect.stringMatching(id)]);
    }
    // Every target a sender names is a seat of the same template.
    for (const agent of [...template.agents, ...template.crew]) {
      for (const target of Array.isArray(agent.handoffs) ? agent.handoffs : []) expect(roster.has(target)).toBe(true);
    }
  });

  it.each(all)("$name has the writer wait for the researcher on day one, and only then write the calendar", (template) => {
    const writer = template.agents.find((a) => a.name === "content-writer")!;
    expect(writer.intake?.message).toMatch(/Do not write the calendar or a post yet/);
    expect(writer.schedules?.[0]?.input).toMatch(/If no calendar is filed yet, stop/);
    const researcher = template.agents.find((a) => a.name === "gap-researcher")!;
    expect(researcher.intake?.message).toMatch(/send_to_agent: agent content-writer, wait false/);
  });
});

describe("blank", () => {
  /**
   * The point of the template. `blank` is a working agency for someone who does not do search, so
   * nothing in it — not a prompt, not a kind, not a seed row, not a word on the site — may name a
   * specialism. This is the assertion the old single-product blueprint could not have passed:
   * every prompt and every seed row in it was about SEO.
   */
  it("names no specialism anywhere", () => {
    // `keyword` is not on the list: the plan's blank crew has a gap-researcher who compares keywords
    // and page types — marketing, not search engineering. The specialism's own words stay banned.
    expect(prose(blank)).not.toMatch(/\bSEO\b|\bGEO\b|search engine|generative-engine|SERP|schema|llms\.txt|citation/i);
  });

  it("declares no per-client crew — the agency's own eight run every client", () => {
    expect(blank.crew).toEqual([]);
    expect(blank.words.noCrew).toMatch(/agency's own eight/);
  });

  it("files generic deliverable kinds", () => {
    expect(blank.kinds.map((k) => k.id)).toEqual(["post", "page", "report", "audit"]);
  });
});

/**
 * The schedules, which are template data like everything else here — and the one place this
 * blueprint fires without an operator watching, so the two fields nobody sets by accident matter
 * most: an absent `timezone` is UTC by the API's default, and an absent `identity` is a fire that
 * speaks as nobody and resolves no connected account.
 */
describe("schedules", () => {
  const declared = (template: (typeof all)[number]) =>
    template.agents.flatMap((agent) => (agent.schedules ?? []).map((schedule) => [agent.name, schedule] as const));

  it.each(all)("$name runs the plan's five timers, and none for the site-builder or the proposal-writer", (template) => {
    expect(declared(template).map(([agent, schedule]) => [agent, schedule.cron])).toEqual([
      // A pipeline goes stale in days: weekday mornings, before the weekly review it feeds.
      ["sales", "30 8 * * 1-5"],
      ["client-manager", "0 8 * * 1"],
      ["content-writer", "0 7 * * 2,4"],
      ["content-reviser", "0 9 * * 3"],
      ["gap-researcher", "0 9 * * 5"],
    ]);
  });

  it.each(all)("$name fires each one in the agency's zone, as the agency", (template) => {
    for (const [agent, schedule] of declared(template)) {
      const at = `${agent} @ ${schedule.cron}`;
      expect([at, schedule.timezone]).toEqual([at, AGENCY_TIMEZONE]);
      expect([at, schedule.identity]).toEqual([at, AGENCY_IDENTITY]);
      // A session naming a persona its agent does not hold is refused before it runs, so the
      // schedule's identity is only reachable because the agent above holds the same one.
      const holder = template.agents.find((one) => one.name === agent);
      expect([at, holder?.identity]).toEqual([at, schedule.identity]);
      // The zone must be one the platform can schedule in: `POST /v1/deployments` validates it
      // through `Intl` and refuses what it cannot format.
      expect(() => new Intl.DateTimeFormat("en-US", { timeZone: schedule.timezone })).not.toThrow();
    }
  });
  it.each(all)("$name says what every fire comes to, in a few plain words for the launch card", (template) => {
    expect(declared(template).map(([agent, schedule]) => [agent, schedule.summary])).toEqual([
      ["sales", "Replies and new leads"],
      ["client-manager", "Client check-in"],
      ["content-writer", "New blog post"],
      ["content-reviser", "Fix weak pages"],
      ["gap-researcher", "Competitor gap report"],
    ]);
  });
});

describe("the launch card's words", () => {
  it("names each template the way an owner would, never by its id", () => {
    expect(all.map((t) => [t.name, t.title])).toEqual([["blank", "Agency"]]);
    for (const t of all) {
      expect(t.title.length).toBeLessThanOrEqual(80);
      expect(t.description.length).toBeLessThanOrEqual(280);
    }
  });

  it("says what Day 1 comes to, and claims no every-day line the weekday timers cannot keep", () => {
    expect(all.map((t) => [t.name, t.roadmap])).toEqual([
      ["blank", { day_one: "Set up your site, pipeline and first drafts" }],
    ]);
    // Every timer is weekday-only or weekly, so "every day" would promise weekends that do not run.
    for (const t of all) {
      expect(t.roadmap.every_day).toBeUndefined();
      for (const schedule of t.agents.flatMap((agent) => agent.schedules ?? [])) {
        expect(schedule.cron.split(" ")[4]).not.toBe("*");
      }
    }
  });

  it("speaks in outcomes, never tool names or the prompt's own instructions", () => {
    for (const t of all) {
      const summaries = t.agents.flatMap((agent) => (agent.schedules ?? []).map((s) => s.summary!));
      expect(t.roadmap.day_one!.length).toBeLessThanOrEqual(60);
      for (const summary of summaries) expect(summary.length).toBeLessThanOrEqual(48);
      for (const line of [t.roadmap.day_one!, ...summaries]) expect(line).not.toMatch(/project_context|_|\.|\(/);
    }
  });
});

describe("kindLabel", () => {
  it("names a kind the active template declares, and passes any other through", () => {
    const [first] = TEMPLATES[TEMPLATE].kinds;
    expect(kindLabel(first!.id)).toBe(first!.label);
    // A row filed under another template keeps its kind after a switch; the screen shows the id
    // rather than an empty chip.
    expect(kindLabel("a-kind-from-another-template")).toBe("a-kind-from-another-template");
  });
});

/**
 * The README is where a person reads what an install will cost, before they can read a declaration.
 * It said an intake was capped at $2 and day one at $14 while `templates/agents.ts` declared
 * 20_000_000 µUSD and seven agents — so derive both figures from the declarations here, and the
 * next retune cannot leave the number behind.
 */
describe("what the README promises about spend", () => {
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  const usd = (micro: number) => `$${(micro / 1_000_000).toLocaleString("en-US")}`;
  const agents = blank.agents ?? [];
  const intake = agents[0]!.intake!.budget_micro_usd!;
  const cap = agents[0]!.budget!.cap_micro_usd;

  it("names the one-time intake ceiling, its day-one total, and the separate recurring cap", () => {
    // One `intake` each, spent once at the apply: the ceiling is per agent and the total is one-off.
    expect(readme).toContain(`**${usd(intake)}**`);
    expect(readme).toContain(`**${usd(intake * agents.length)}**`);
    // The recurring cap is a different number on a different clock, and must be stated as one.
    expect(readme).toContain(`**${usd(cap)}**`);
    expect(readme).not.toContain("$14 ");
  });
});
