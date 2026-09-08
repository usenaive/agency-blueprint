/**
 * The two templates of the `agency` blueprint, held to what a template is.
 *
 * A template is DATA — agents and prompts, tool allow-lists, deliverable kinds, schedules, the
 * demo seed, the screen vocabulary. The blueprint around it is shared, so the tests below are
 * about the *difference* between the two: `blank` must carry no specialism at all, `seo-geo` must
 * be a delta on it and not a fork of it, and neither may declare a row or a kind the other's
 * screens could not render.
 */
import { describe, expect, it } from "vitest";
import type { Client } from "../seed/clients.ts";
import type { Post } from "../seed/posts.ts";
import { TEMPLATES } from "./active.ts";
import { AGENCY_IDENTITY, AGENCY_TIMEZONE, blank } from "./blank.ts";
import { TEMPLATE, VOCABULARY, kindLabel } from "./index.ts";
import { seoGeo } from "./seo-geo.ts";

const all = Object.values(TEMPLATES);

/** The team every template starts from: what `blank` declares, in order. */
const TEAM = ["sales", "client-manager", "strategist", "researcher", "content-writer", "editor", "analytics-reporter"];

/**
 * The desk roles: they read the CRM, the queue and the open web and hold no connected account.
 * Every other agent reaches a mailbox or a client's property, and must be able to.
 */
const DESK = new Set(["strategist", "researcher", "content-writer", "editor"]);

const clientsOf = (t: (typeof all)[number]) => t.seed.clients as Client[];
const postsOf = (t: (typeof all)[number]) => t.seed.posts as Post[];

/** Every string a template puts in front of a person or a model. */
const prose = (t: (typeof all)[number]): string =>
  JSON.stringify([t.description, t.words, t.kinds, t.agents, t.crew, t.seed, VOCABULARY[t.name as keyof typeof VOCABULARY].site]);

describe("every template of this blueprint", () => {
  it("carries both, so a switch is an edit and never a re-clone", () => {
    expect(all.map((t) => t.name).sort()).toEqual(["blank", "seo-geo"]);
    expect(TEMPLATES[TEMPLATE].name).toBe(TEMPLATE);
  });

  it.each(all)("$name declares the team that runs an agency, with the gate in every prompt", (template) => {
    expect(template.agents.map((a) => a.name).slice(0, TEAM.length)).toEqual(TEAM);
    const names = [...template.agents, ...template.crew].map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
    for (const agent of [...template.agents, ...template.crew]) {
      expect(agent.system).toMatch(/never send or publish anything yourself/);
      expect(agent.description).toBeTruthy();
      expect(agent.model).toBeTruthy();
      expect(agent.tools?.default_config.permission).toBe("deny");
      // Every role files something the operator reads; none approves or publishes it.
      const held = Object.keys(agent.tools?.configs ?? {});
      expect([agent.name, held.some((name) => name === "dashboard.create_draft_post" || name === "dashboard.add_client_note")]).toEqual([agent.name, true]);
      expect(held).not.toContain("dashboard.approve_post");
      expect(held.filter((name) => name.startsWith("social."))).toEqual([]);
    }
  });

  /**
   * The whole team is `agents`. `defineProject` folds only a template's `agents` into the
   * declaration, and the catalog's template card lists `declaration.agents` — so a role declared
   * anywhere else is one the dashboard says the template does not have. The per-client crew is the
   * one exception, because its names carry a client slug and cannot be declared statically.
   */
  it.each(all)("$name puts every agency-wide role in `agents`, where the artifact publishes it", (template) => {
    expect(template.agents.length).toBeGreaterThanOrEqual(TEAM.length);
    for (const agent of template.agents) expect(agent.name).not.toMatch(/--/);
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

  it.each(all)("$name grants every agent that works an account at least one of them", (template) => {
    for (const agent of [...template.agents, ...template.crew]) {
      expect([agent.name, connectionTools(agent).length > 0]).toEqual([agent.name, !DESK.has(agent.name)]);
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
    expect(prose(blank)).not.toMatch(/\bSEO\b|\bGEO\b|search engine|generative-engine|SERP|keyword|schema|llms\.txt/i);
  });

  it("declares no per-client crew — the agency's own team runs every client", () => {
    expect(blank.crew).toEqual([]);
    expect(blank.agents.map((a) => a.name)).toEqual(TEAM);
    expect(blank.words.noCrew).toMatch(/agency's own team/);
  });

  it("files generic deliverable kinds", () => {
    expect(blank.kinds.map((k) => k.id)).toEqual(["post", "page", "report", "audit"]);
  });
});

describe("seo-geo", () => {
  it("is a delta on blank, not a fork of it", () => {
    // Same team, same model, same budget, same schedule: only the focus differs, and the reporter
    // gains the Search Console reads its month needs on top of blank's allow-list.
    expect(seoGeo.agents.map((a) => a.name).slice(0, TEAM.length)).toEqual(blank.agents.map((a) => a.name));
    for (const [i, base] of blank.agents.entries()) {
      const agent = seoGeo.agents[i]!;
      expect(agent.system).toContain(base.system);
      expect(agent.system).not.toBe(base.system);
      expect({ ...agent, system: "", tools: undefined }).toEqual({ ...base, system: "", tools: undefined });
      for (const [name, config] of Object.entries(base.tools?.configs ?? {})) expect(agent.tools?.configs[name]).toEqual(config);
    }
    expect(seoGeo.agents.find((a) => a.name === "analytics-reporter")?.tools?.configs).toHaveProperty("googlesearchconsole.query_search_analytics");
  });

  it("adds the specialism: the specialists, the kinds, and the crew provisioned per client", () => {
    expect(seoGeo.agents.map((a) => a.name).slice(TEAM.length)).toEqual(["keyword-researcher", "link-outreach", "technical-seo"]);
    // Each specialist reads the account its job is about, and only outreach may (ask to) send.
    const specialist = (name: string) => Object.entries(seoGeo.agents.find((a) => a.name === name)!.tools!.configs);
    expect(specialist("keyword-researcher").map(([name]) => name)).toContain("googlesearchconsole.query_search_analytics");
    expect(specialist("technical-seo").map(([name]) => name)).toContain("googlesearchconsole.inspect_url");
    expect(specialist("link-outreach").find(([name]) => name === "email.send")?.[1]).toEqual({ enabled: true, permission: "ask" });
    expect(seoGeo.agents.filter((a) => a.tools?.configs["email.send"]).map((a) => a.name)).toEqual(["sales", "client-manager", "link-outreach"]);
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

  const RHYTHM: [string, string][] = [
    // A pipeline goes stale in days: weekday mornings, before the weekly review it feeds.
    ["sales", "30 8 * * 1-5"],
    ["client-manager", "0 8 * * 1"],
    ["strategist", "0 9 1 1,4,7,10 *"],
    ["researcher", "0 9 15 * *"],
    // The writers write against Monday's review; the editor reads before the operator's evening pass.
    ["content-writer", "0 9 * * 2"],
    ["editor", "0 16 * * 1-5"],
    ["analytics-reporter", "0 9 1 * *"],
  ];

  it("blank runs the agency's rhythm: daily pipeline and edit passes, weekly review and writing, monthly and quarterly reports", () => {
    expect(declared(blank).map(([agent, schedule]) => [agent, schedule.cron])).toEqual(RHYTHM);
  });

  it("seo-geo keeps that rhythm and adds the specialists' weekly passes", () => {
    expect(declared(seoGeo).map(([agent, schedule]) => [agent, schedule.cron])).toEqual([
      ...RHYTHM,
      ["keyword-researcher", "30 9 * * 1"],
      ["link-outreach", "0 9 * * 3"],
      ["technical-seo", "0 7 * * 4"],
    ]);
  });

  it.each(all)("$name keeps every fire under the agent's own per-task ceiling", (template) => {
    for (const [agent, schedule] of declared(template)) {
      const holder = template.agents.find((one) => one.name === agent)!;
      expect([agent, (schedule.budget_micro_usd ?? 0) <= holder.budget!.max_task_micro_usd!]).toEqual([agent, true]);
    }
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
