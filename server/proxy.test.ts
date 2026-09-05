import { describe, expect, it, vi } from "vitest";
import { ACTIVE_TEMPLATE, TEMPLATES } from "../templates/active";
import { configFromEnv, listAgents, provisionClientAgents, proxyFetch, upstreamFor } from "./proxy";

describe("upstreamFor", () => {
  it("does not map the agent roster, which is paged and cannot be relayed one page at a time", () => {
    expect(upstreamFor("GET", "/api/agents", null)).toBeNull();
  });

  it("maps chat to session create and the stream to an SSE relay", () => {
    expect(upstreamFor("POST", "/api/chat", null)).toEqual({ method: "POST", path: "/v1/sessions" });
    expect(upstreamFor("GET", "/api/chat/ses_abc/stream", null)).toEqual({
      method: "GET", path: "/v1/sessions/ses_abc/stream", sse: true,
    });
    expect(upstreamFor("GET", "/api/chat/not-a-session/stream", null)).toBeNull();
  });

  it("routes social paths through the client identity", () => {
    expect(upstreamFor("POST", "/api/social/portal", "idn_1")).toEqual({ method: "POST", path: "/v1/identities/idn_1/social/portal" });
  });

  it("refuses social paths without an identity, traversal, and unknown routes", () => {
    expect(upstreamFor("POST", "/api/social/portal", null)).toBeNull();
    expect(upstreamFor("GET", "/api/social/../secrets", "idn_1")).toBeNull();
    expect(upstreamFor("GET", "/api/nope", "idn_1")).toBeNull();
  });
});

describe("configFromEnv", () => {
  it("is null without a key, and trims the base url's trailing slash", () => {
    expect(configFromEnv({})).toBeNull();
    expect(configFromEnv({ NAIVE_API_KEY: "k", NAIVE_API_URL: "https://x.test/" })).toEqual({
      apiKey: "k",
      baseUrl: "https://x.test",
      identityId: null,
    });
  });
});

describe("proxyFetch", () => {
  it("attaches the key upstream only", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}"));
    await proxyFetch({ apiKey: "k", baseUrl: "https://x.test", identityId: null }, { method: "GET", path: "/v1/agents" }, null, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledWith("https://x.test/v1/agents", expect.objectContaining({
      method: "GET",
      headers: expect.objectContaining({ authorization: "Bearer k" }),
    }));
  });
});

describe("listAgents", () => {
  const config = { apiKey: "k", baseUrl: "https://x.test", identityId: null };
  const page = (rows: { id: string; name: string }[], next: string | null) =>
    new Response(JSON.stringify({ data: rows, has_more: next !== null, next_cursor: next }), { status: 200 });

  it("follows the cursor to the end — the platform pages at 20 and an agency org has hundreds", async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => {
      const after = new URL(String(url)).searchParams.get("after");
      if (after === null) return page([{ id: "agt_1", name: "sales" }], "agt_1");
      if (after === "agt_1") return page([{ id: "agt_2", name: "client-manager" }], "agt_2");
      return page([{ id: "agt_3", name: "seo-writer--acme" }], null);
    });
    expect(await listAgents(config, fetchImpl as typeof fetch)).toEqual([
      { id: "agt_1", name: "sales" },
      { id: "agt_2", name: "client-manager" },
      { id: "agt_3", name: "seo-writer--acme" },
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    // 100 is the spec's per-page ceiling; asking for less is more round trips for the same rows.
    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe("https://x.test/v1/agents?limit=100");
  });

  it("stops at the last page, and answers null rather than a partial roster when a page fails", async () => {
    const one = vi.fn(async () => page([{ id: "agt_1", name: "sales" }], null));
    expect(await listAgents(config, one as typeof fetch)).toHaveLength(1);
    expect(one).toHaveBeenCalledTimes(1);

    // A half-read roster silently means "that agent does not exist", which is the bug, not a fix.
    let calls = 0;
    const flaky = vi.fn(async () =>
      (calls += 1) === 1 ? page([{ id: "agt_1", name: "sales" }], "agt_1") : new Response("nope", { status: 503 }));
    expect(await listAgents(config, flaky as typeof fetch)).toBeNull();
  });
});

describe("provisionClientAgents", () => {
  const config = { apiKey: "k", baseUrl: "https://x.test", identityId: null };
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
  /** Named, not "the active one": the mechanism is the blueprint's and must hold for either template. */
  const crew = TEMPLATES["seo-geo"].crew;

  it("provisions the active template's crew when none is named", async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) =>
      init?.method === "GET" ? json({ data: [] }) : json({ id: "agt_new" }));
    const reports = await provisionClientAgents(config, "acme", fetchImpl as typeof fetch);
    expect(reports?.map((r) => r.name)).toEqual(ACTIVE_TEMPLATE.crew.map((one) => `${one.name}--acme`));
  });

  it("creates the missing agents and leaves existing ones untouched", async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) =>
      init?.method === "GET" ? json({ data: [{ name: "seo-writer--acme" }] }) : json({ id: "agt_new" }));
    expect(await provisionClientAgents(config, "acme", fetchImpl as typeof fetch, crew)).toEqual([
      { name: "seo-writer--acme", action: "unchanged" },
      { name: "geo-optimizer--acme", action: "created" },
      { name: "audit-runner--acme", action: "created" },
    ]);
    // Two creates only — the existing agent is never re-posted.
    const posts = fetchImpl.mock.calls.filter(([, init]) => init?.method === "POST");
    expect(posts).toHaveLength(2);
    const bodies = posts.map(([, init]) => JSON.parse(String(init?.body)) as Record<string, unknown>);
    expect(bodies.map((b) => b.name)).toEqual(["geo-optimizer--acme", "audit-runner--acme"]);
    // POST /v1/agents requires model and budget, and every one of these fields is the template's:
    // the server holds no crew, no prompt and no model of its own any more.
    for (const body of bodies) {
      const member = crew.find((one) => String(body.name).startsWith(`${one.name}--`));
      expect(member).toBeDefined();
      expect(body.model).toBe(member?.model);
      expect(body.budget).toEqual(member?.budget);
      expect(body.system).toBe(member?.system);
      expect(String(body.system)).toMatch(/never send or publish anything yourself/);
      expect(body.tools).toMatchObject({ default_config: { permission: "deny" } });
    }
  });

  it("keeps a crew the new template does not declare, and never deletes it", async () => {
    // The switch rule: WIDEN, NEVER NARROW. This is `seo-geo` → `blank`, which declares no crew at
    // all: every agent the old template provisioned is reported and left exactly as it is. An
    // agent is deleted only by an explicit `removed:` tombstone, exactly as in the reconciler.
    const roster = [
      ...crew.map(({ name }, i) => ({ id: `agt_${i}`, name: `${name}--acme` })),
      { id: "agt_y", name: "seo-writer--other-client" },
    ];
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) =>
      init?.method === "GET" ? json({ data: roster }) : json({ id: "agt_new" }));
    const reports = await provisionClientAgents(config, "acme", fetchImpl as typeof fetch, TEMPLATES.blank.crew);
    expect(reports).toEqual(crew.map(({ name }) => ({ name: `${name}--acme`, action: "kept" })));
    // Another client's crew is not this client's business, and nothing was written at all.
    expect(reports?.map((r) => r.name)).not.toContain("seo-writer--other-client");
    expect(fetchImpl.mock.calls.filter(([, init]) => init?.method !== "GET")).toHaveLength(0);
    expect(fetchImpl.mock.calls.filter(([, init]) => init?.method === "DELETE")).toHaveLength(0);
  });

  it("sees a crew that is past page one, instead of creating it again under the same name", async () => {
    // The whole point: an agency with a few clients pushes its older crews off page one, and the
    // previous read of page one alone re-posted every one of them on each onboard.
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method !== "GET") return json({ id: "agt_new" });
      return new URL(String(url)).searchParams.get("after") === null
        ? new Response(JSON.stringify({ data: [{ id: "agt_1", name: "sales" }], has_more: true, next_cursor: "agt_1" }))
        : new Response(JSON.stringify({
            data: crew.map(({ name }, i) => ({ id: `agt_${i + 2}`, name: `${name}--acme` })),
            has_more: false,
            next_cursor: null,
          }));
    });
    const reports = await provisionClientAgents(config, "acme", fetchImpl as typeof fetch, crew);
    expect(reports?.every((r) => r.action === "unchanged")).toBe(true);
    expect(fetchImpl.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(0);
  });

  it("answers null when the roster cannot be read, failed when a create is refused", async () => {
    const down = vi.fn(async () => new Response("nope", { status: 503 }));
    expect(await provisionClientAgents(config, "acme", down as unknown as typeof fetch)).toBeNull();

    const refusing = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) =>
      init?.method === "GET" ? json({ data: [] }) : new Response("{}", { status: 402 }));
    const reports = await provisionClientAgents(config, "acme", refusing as typeof fetch, crew);
    expect(reports?.length).toBe(crew.length);
    expect(reports?.every((r) => r.action === "failed")).toBe(true);
  });
});
