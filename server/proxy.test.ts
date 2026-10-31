import { describe, expect, it, vi } from "vitest";
import { collect, configFromEnv, identityConnections, listAgents, platformGet } from "./proxy";

describe("configFromEnv", () => {
  it("is null without a key, and trims the base url's trailing slash", () => {
    expect(configFromEnv({})).toBeNull();
    expect(configFromEnv({ NAIVE_API_KEY: "k", NAIVE_API_URL: "https://x.test/" })).toEqual({
      apiKey: "k",
      baseUrl: "https://x.test",
      identityId: null,
      project: "agency",
    });
  });

  /**
   * Measured on staging: the install is filed under the customer's slug (`ws12-staging-blank`) and
   * the dashboard asked for `project=agency`, so `/api/context` was a 404 on every deployed install.
   * The platform writes the install's own project as `NAIVE_PROJECT`; the declaration's name is
   * only the fallback for a laptop `naive up`, which files under it.
   */
  it("reads the install's project from NAIVE_PROJECT and falls back to the declaration's name", () => {
    expect(configFromEnv({ NAIVE_API_KEY: "k", NAIVE_PROJECT: "ws12-staging-blank" })?.project).toBe("ws12-staging-blank");
    expect(configFromEnv({ NAIVE_API_KEY: "k" })?.project).toBe("agency");
  });
});

describe("platformGet", () => {
  it("attaches the key upstream only", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}"));
    await platformGet({ apiKey: "k", baseUrl: "https://x.test", identityId: null, project: "agency" }, "/v1/agents", fetchImpl as typeof fetch);
    expect(fetchImpl).toHaveBeenCalledWith("https://x.test/v1/agents", expect.objectContaining({
      method: "GET",
      headers: expect.objectContaining({ authorization: "Bearer k" }),
    }));
  });
});

describe("listAgents", () => {
  const config = { apiKey: "k", baseUrl: "https://x.test", identityId: null, project: "agency" };
  const page = (rows: { id: string; name: string }[], next: string | null) =>
    new Response(JSON.stringify({ data: rows, has_more: next !== null, next_cursor: next }), { status: 200 });

  it("follows the cursor to the end — the platform pages at 20 and an agency org has hundreds", async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, _init?: RequestInit) => {
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

  it("reads the timers the same way — a timer on an unread page is an agent shown with none", async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, _init?: RequestInit) => {
      const after = new URL(String(url)).searchParams.get("after");
      return after === null ? page([{ id: "dep_1", name: "a" }], "dep_1") : page([{ id: "dep_2", name: "b" }], null);
    });
    expect(await collect(config, "/v1/deployments", fetchImpl as typeof fetch)).toHaveLength(2);
    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe("https://x.test/v1/deployments?limit=100");
    expect(String(fetchImpl.mock.calls[1]?.[0])).toBe("https://x.test/v1/deployments?limit=100&after=dep_1");
  });
});


describe("identityConnections", () => {
  const config = { apiKey: "k", baseUrl: "https://x.test", identityId: "idn_1", project: "agency" };
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

  it("reads each connected account of the persona, with GETs only", async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, _init?: RequestInit) =>
      String(url).endsWith("/v1/identities/idn_1") ? json({ connections: ["con_1"] }) : json({ connector: "googleads", status: "active" }));
    expect(await identityConnections(config, fetchImpl as typeof fetch)).toEqual([{ connector: "googleads", status: "active" }]);
    expect(fetchImpl.mock.calls.every(([, init]) => init?.method === "GET")).toBe(true);
  });

  it("is none without a persona, and null when the platform cannot be read", async () => {
    expect(await identityConnections({ ...config, identityId: null }, vi.fn() as unknown as typeof fetch)).toEqual([]);
    expect(await identityConnections(config, (async () => new Response("", { status: 502 })) as typeof fetch)).toBeNull();
  });
});
