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
import { blank } from "./blank.ts";
import { TEMPLATE, VOCABULARY, kindLabel } from "./index.ts";
import { seoGeo } from "./seo-geo.ts";

const all = Object.values(TEMPLATES);
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

  it.each(all)("$name declares the pair that runs an agency, with the gate in every prompt", (template) => {
    expect(template.agents.map((a) => a.name)).toEqual(["sales", "client-manager"]);
    for (const agent of [...template.agents, ...template.crew]) {
      expect(agent.system).toMatch(/never send or publish anything yourself/);
      expect(agent.model).toBeTruthy();
      expect(agent.tools?.default_config.permission).toBe("deny");
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
    Object.entries(agent.tools?.configs ?? {}).filter(([name]) => name.includes(".") && !name.startsWith("dashboard."));

  it.each(all)("$name grants every agent at least one of them", (template) => {
    for (const agent of [...template.agents, ...template.crew]) {
      expect([agent.name, connectionTools(agent).length > 0]).toEqual([agent.name, true]);
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

  it("declares no per-client crew — the agency's own pair runs every client", () => {
    expect(blank.crew).toEqual([]);
    expect(blank.words.noCrew).toMatch(/agency's own pair/);
  });

  it("files generic deliverable kinds", () => {
    expect(blank.kinds.map((k) => k.id)).toEqual(["post", "page", "report", "audit"]);
  });
});

describe("seo-geo", () => {
  it("is a delta on blank, not a fork of it", () => {
    // Same pair, same model, same budget, same allow-list, same schedule: only the focus differs.
    expect(seoGeo.agents.map((a) => a.name)).toEqual(blank.agents.map((a) => a.name));
    for (const [i, agent] of seoGeo.agents.entries()) {
      const base = blank.agents[i]!;
      expect(agent.system).toContain(base.system);
      expect(agent.system).not.toBe(base.system);
      expect({ ...agent, system: "" }).toEqual({ ...base, system: "" });
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

describe("kindLabel", () => {
  it("names a kind the active template declares, and passes any other through", () => {
    const [first] = TEMPLATES[TEMPLATE].kinds;
    expect(kindLabel(first!.id)).toBe(first!.label);
    // A row filed under another template keeps its kind after a switch; the screen shows the id
    // rather than an empty chip.
    expect(kindLabel("a-kind-from-another-template")).toBe("a-kind-from-another-template");
  });
});
