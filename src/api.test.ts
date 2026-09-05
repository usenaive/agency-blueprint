import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiGet, apiMessage, apiSend } from "./api";

afterEach(() => vi.unstubAllGlobals());

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("failure is reported, never replaced", () => {
  it("throws the server's own sentence, with its status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ error: "not configured — set NAIVE_API_KEY" }, 503)));
    // The old contract answered a caller-supplied fallback here — and the fallbacks were the seed
    // rows, so an unwired dashboard showed a fictional agency as the operator's own CRM.
    await expect(apiGet("/agents")).rejects.toThrow("not configured — set NAIVE_API_KEY");
    await expect(apiGet("/agents")).rejects.toMatchObject({ status: 503 });
  });

  it("says the server is unreachable when the fetch fails or the answer is not this server's", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("no server")));
    await expect(apiGet("/clients")).rejects.toThrow("the dashboard server is unreachable");

    // The SPA fallback serving index.html for a missing function is the exact production shape.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>", { status: 200 })));
    await expect(apiGet("/clients")).rejects.toThrow("the dashboard server is unreachable");
  });

  it("throws on a send too, so a screen never shows a move the server refused", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ error: "no such post" }, 404)));
    await expect(apiSend("PATCH", "/posts/post_1", { status: "approved" })).rejects.toMatchObject({
      status: 404,
      message: "no such post",
    });
  });

  it("apiMessage reads an ApiError and anything else alike", () => {
    expect(apiMessage(new ApiError(404, "no such route"))).toBe("no such route");
    expect(apiMessage(new TypeError("boom"))).toBe("the dashboard server is unreachable");
  });
});

describe("the happy path", () => {
  it("apiGet returns the server's JSON, and an empty list stays empty", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json([{ id: "cli_1" }])));
    expect(await apiGet("/clients")).toEqual([{ id: "cli_1" }]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json([])));
    expect(await apiGet("/clients")).toEqual([]);
  });

  it("apiSend posts the body and returns the server's JSON", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({ id: "post_1", status: "approved" }));
    vi.stubGlobal("fetch", fetchImpl);
    expect(await apiSend("PATCH", "/posts/post_1", { status: "approved" })).toEqual({ id: "post_1", status: "approved" });
    expect(fetchImpl).toHaveBeenCalledWith("/api/posts/post_1", expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ status: "approved" }),
    }));
  });
});

/**
 * `/api/*` is gated by the app's `DASHBOARD_TOKEN` — without it the deployed dashboard hands the
 * CRM, the agent roster and the content queue to anyone who finds the URL.
 */
describe("the operator's access token", () => {
  /** sessionStorage in a sentence: the tests run in node, which has none of its own. */
  const session = () => {
    const kept = new Map<string, string>();
    return {
      getItem: (k: string) => kept.get(k) ?? null,
      setItem: (k: string, v: string) => void kept.set(k, v),
      removeItem: (k: string) => void kept.delete(k),
      kept,
    };
  };

  it("sends the kept token as the bearer on every call", async () => {
    const store = session();
    store.kept.set("dashboard-token", "dash");
    vi.stubGlobal("sessionStorage", store);
    const fetchImpl = vi.fn().mockResolvedValue(json([]));
    vi.stubGlobal("fetch", fetchImpl);

    await apiGet("/clients");
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({ headers: { authorization: "Bearer dash" } });
    // And the caller's own headers survive alongside it.
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({ headers: { accept: "application/json" } });
  });

  it("clears a rejected token, asks once, and retries with the answer", async () => {
    const store = session();
    store.kept.set("dashboard-token", "stale");
    vi.stubGlobal("sessionStorage", store);
    vi.stubGlobal("prompt", vi.fn().mockReturnValue("  fresh  "));
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(json({ error: "missing or invalid access token" }, 401))
      .mockResolvedValueOnce(json([{ id: "cli_1" }]));
    vi.stubGlobal("fetch", fetchImpl);

    expect(await apiGet("/clients")).toEqual([{ id: "cli_1" }]);
    expect(globalThis.prompt).toHaveBeenCalledTimes(1);
    // Trimmed, kept for the tab, and sent on the retry.
    expect(store.kept.get("dashboard-token")).toBe("fresh");
    expect(fetchImpl.mock.calls[1]?.[1]).toMatchObject({ headers: { authorization: "Bearer fresh" } });
  });

  it("throws 401 rather than looping when there is no answer, and keeps nothing", async () => {
    const store = session();
    store.kept.set("dashboard-token", "stale");
    vi.stubGlobal("sessionStorage", store);
    vi.stubGlobal("prompt", vi.fn().mockReturnValue(null));
    const fetchImpl = vi.fn().mockResolvedValue(json({ error: "missing or invalid access token" }, 401));
    vi.stubGlobal("fetch", fetchImpl);

    await expect(apiGet("/clients")).rejects.toMatchObject({ status: 401 });
    expect(store.kept.has("dashboard-token")).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("works with no storage at all — a 503 or a 200 is still the server's own answer", async () => {
    // node has no sessionStorage, which is also a browser in private mode: every access is guarded.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json([])));
    expect(await apiGet("/clients")).toEqual([]);
  });
});
