/**
 * The two templates of the `agency` blueprint, held to what a template is.
 *
 * A template is DATA — agents and prompts, tool allow-lists, deliverable kinds, schedules, the
 * demo seed, the screen vocabulary. The blueprint around it is shared, so the tests below are
 * about the *difference* between the two: `blank` must carry no specialism at all, `seo-geo` must
 * be a delta on it and not a fork of it, and neither may declare a row or a kind the other's
 * screens could not render.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Client } from "../seed/clients.ts";
import type { Post } from "../seed/posts.ts";
import { TEMPLATES } from "./active.ts";
import { AGENCY_IDENTITY, AGENCY_TIMEZONE, PREAMBLE } from "./agents.ts";
import { blank } from "./blank.ts";
import { TEMPLATE, VOCABULARY, kindLabel } from "./index.ts";
import { seoGeo } from "./seo-geo.ts";

/** Plan §2.1's roster, name and role, in the order the studio lists them. */
const ROSTER = [
  ["site-builder", "Public site"],
  ["sales", "Pipeline"],
  ["client-manager", "Delivery"],
  ["content-writer", "Content"],
  ["content-reviser", "Revisions"],
  ["gap-researcher", "Research"],
  ["proposal-writer", "Proposals"],
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
  it("carries both, so a switch is an edit and never a re-clone", () => {
    expect(all.map((t) => t.name).sort()).toEqual(["blank", "seo-geo"]);
    expect(TEMPLATES[TEMPLATE].name).toBe(TEMPLATE);
  });

  it.each(all)("$name declares the seven that run an agency, with the gate in every prompt", (template) => {
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
  it.each(all)("$name writes each of the seven to the plan's shape", (template) => {
    for (const agent of template.agents) {
      const at = agent.name;
      expect([at, agent.system?.startsWith(PREAMBLE)]).toEqual([at, true]);
      expect([at, agent.description?.match(/[.!?](\s|$)/g)?.length]).toEqual([at, 2]);
      const n = words(agent.system ?? "");
      expect([at, n >= 150 && n <= 400]).toEqual([at, true]);
      expect([at, (agent.skills ?? []).length > 0]).toEqual([at, true]);
      for (const ref of agent.skills ?? []) expect([at, ref]).toEqual([at, expect.stringMatching(/^naive\/[a-z0-9-]+(@\d+)?$/)]);
      expect([at, agent.intake?.budget_micro_usd]).toEqual([at, 20_000_000]);
      for (const schedule of agent.schedules ?? []) expect([at, Number.isInteger(schedule.budget_micro_usd)]).toEqual([at, true]);
    }
  });

  it.each(all)("$name asks the three setup questions, as text, and no fourth", (template) => {
    expect(template.questions.map((q) => q.type)).toEqual(["text", "text", "text"]);
    expect(template.questions.map((q) => q.key)).toEqual(["offer", "ideal_client", template.name === "blank" ? "pricing" : "competitors"]);
  });

  it.each(all)("$name never sends an agent to a setup answer the template did not ask for", (template) => {
    // `seo-geo` spends its third question on competitors, so its context holds no pricing answer;
    // the site-builder and the proposal-writer, who both write from one, are told to ask the operator
    // instead — never to read the absence as "free" or to invent a tier.
    const asked = new Set(template.questions.map((q) => q.key));
    for (const name of ["site-builder", "proposal-writer"]) {
      const agent = template.agents.find((a) => a.name === name)!;
      expect(agent.system, name).toMatch(/pricing answer when the context holds one.*when it does not.*ask_operator/);
    }
    const gap = template.agents.find((a) => a.name === "gap-researcher")!;
    expect((gap.system ?? "").includes("third setup answer")).toBe(asked.has("competitors"));
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
    Object.entries(agent.tools?.configs ?? {}).filter(([name]) => name.includes(".") && !name.startsWith("dashboard."));

  it.each(all)("$name grants them to the two that reach outward, and to no one who does not", (template) => {
    // Deny-by-default names only what an agent needs: the mailbox is the pipeline's and delivery's;
    // a writer, a researcher or the site-builder holds no connected account at all.
    for (const agent of template.agents) {
      const outward = agent.name === "sales" || agent.name === "client-manager";
      expect([agent.name, connectionTools(agent).length > 0]).toEqual([agent.name, outward]);
    }
    for (const agent of template.crew) expect([agent.name, connectionTools(agent).length > 0]).toEqual([agent.name, true]);
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
        const outward = /\.(send|post|publish|create|update|delete|write|reply)/.test(name);
        expect([name, config.permission]).toEqual([name, outward ? "ask" : "allow"]);
      }
    }
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

  it("declares no per-client crew — the agency's own seven run every client", () => {
    expect(blank.crew).toEqual([]);
    expect(blank.words.noCrew).toMatch(/agency's own seven/);
  });

  it("files generic deliverable kinds", () => {
    expect(blank.kinds.map((k) => k.id)).toEqual(["post", "page", "report", "audit"]);
  });
});

describe("seo-geo", () => {
  it("is a delta on blank, not a fork of it", () => {
    // Same seven, same model, same budget, same allow-list, same schedule: only the focus and the
    // search skills differ, and the search skills are added to the generic ones, never in their place.
    expect(seoGeo.agents.map((a) => a.name)).toEqual(blank.agents.map((a) => a.name));
    for (const [i, agent] of seoGeo.agents.entries()) {
      const base = blank.agents[i]!;
      expect(agent.system).toContain(base.system);
      expect(agent.system).not.toBe(base.system);
      expect(agent.skills?.slice(0, base.skills?.length)).toEqual(base.skills);
      expect({ ...agent, system: "", skills: [] }).toEqual({ ...base, system: "", skills: [] });
    }
  });

  it("adds the specialism: the kinds, and the crew provisioned per client", () => {
    expect(seoGeo.kinds.map((k) => k.id)).toEqual(["article", "landing-page", "answer-block", "serp-report", "audit"]);
    expect(seoGeo.crew.map((a) => a.name)).toEqual(["seo-writer", "geo-optimizer", "audit-runner"]);
    // The crew's model is the template's, not the server's — `server/proxy.ts` posts these as they
    // stand and decides nothing.
    for (const member of seoGeo.crew) expect(member.model).toBe(blank.agents[0]!.model);
  });

  it("widens over blank: it drops no agent blank declares", () => {
    const gone = blank.agents.map((a) => a.name).filter((name) => !seoGeo.agents.some((a) => a.name === name));
    expect(gone).toEqual([]);
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
