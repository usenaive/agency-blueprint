// @vitest-environment jsdom
/**
 * The gate screen: what a browser sees before `/api/session` answers, and instead of the dashboard
 * when it answers "no". Rendered rather than unit-tested because the claim is about ordering — no
 * screen mounts, and so nothing gated is fetched, until the session says the browser is in — and
 * about the one automatic bounce to the studio, which must happen exactly once per tab.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { ATTEMPTED, Gate, type Session } from "./Gate";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const STUDIO = "https://app.usenaive.ai/apps/app_123/open";
const signedOut: Session = { authenticated: false, studio_url: STUDIO, password_enabled: true };

/** A `sessionStorage` the test can read back, and a `location` whose `assign` goes nowhere. */
function stubBrowser(search = "", stored: Record<string, string> = {}) {
  vi.stubGlobal("sessionStorage", {
    getItem: (k: string) => stored[k] ?? null,
    setItem: (k: string, v: string) => { stored[k] = v; },
    removeItem: (k: string) => { delete stored[k]; },
  });
  const assign = vi.fn();
  vi.stubGlobal("location", { search, assign });
  return { stored, assign };
}

async function render(answer: () => Promise<Session>) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", ((url: string) => {
    calls.push(String(url));
    return answer().then((body) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } }));
  }) as unknown as typeof fetch);
  const host = document.createElement("div");
  document.body.append(host);
  await act(async () => {
    createRoot(host).render(<Gate><main data-testid="app">The dashboard</main></Gate>);
  });
  const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  await settle();
  const text = () => (host.textContent ?? "").replace(/\s+/g, " ").trim();
  return { host, text, calls, settle };
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("the gate screen", () => {
  it("asks /api/session before anything else, and renders nothing of the dashboard until it answers", async () => {
    stubBrowser();
    let reply: ((s: Session) => void) | undefined;
    const pending = new Promise<Session>((r) => { reply = r; });
    const { host, text, calls, settle } = await render(() => pending);
    expect(calls).toEqual(["/api/session"]);
    expect(host.querySelector("[data-testid=app]")).toBeNull();
    expect(text()).toBe("");
    await act(async () => { reply!({ authenticated: true, studio_url: STUDIO, password_enabled: true }); });
    await settle();
    expect(text()).toBe("The dashboard");
    // Still the one request: the gate itself fetched nothing else.
    expect(calls).toEqual(["/api/session"]);
  });

  it("clears the bounce flag once the browser is in, so the next signed-out tab bounces again", async () => {
    const { stored } = stubBrowser("", { [ATTEMPTED]: "1" });
    const { text } = await render(() => Promise.resolve({ authenticated: true, studio_url: null, password_enabled: false }));
    expect(text()).toBe("The dashboard");
    expect(stored[ATTEMPTED]).toBeUndefined();
  });

  it("bounces a signed-out browser to the studio exactly once, drawing nothing on the way", async () => {
    const { stored, assign } = stubBrowser();
    const first = await render(() => Promise.resolve(signedOut));
    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith(STUDIO);
    expect(stored[ATTEMPTED]).toBe("1");
    expect(first.text()).toBe("");
    expect(first.host.querySelector("form")).toBeNull();

    // The studio could not hand the browser back and it landed here again: no second bounce.
    document.body.innerHTML = "";
    const second = await render(() => Promise.resolve(signedOut));
    expect(assign).toHaveBeenCalledTimes(1);
    expect(second.host.querySelector("a[href]")?.getAttribute("href")).toBe(STUDIO);
    expect(second.text()).toContain("Open with Naive Studio");
  });

  it("offers the studio link and a plain password form — a real POST to /api/enter, not a fetch", async () => {
    stubBrowser("", { [ATTEMPTED]: "1" });
    const { host, text, calls } = await render(() => Promise.resolve(signedOut));
    const form = host.querySelector("form");
    expect(form?.getAttribute("method")).toBe("post");
    expect(form?.getAttribute("action")).toBe("/api/enter");
    const input = host.querySelector<HTMLInputElement>("input[name=password]");
    expect(input?.type).toBe("password");
    expect(input?.autocomplete).toBe("current-password");
    expect(text()).toContain("Open with Naive Studio");
    expect(text()).not.toContain("didn't check out");
    expect(host.querySelector("[data-testid=app]")).toBeNull();
    expect(calls).toEqual(["/api/session"]);
  });

  it("with `entry=denied` says so, and does not bounce even on a first visit", async () => {
    const { assign, stored } = stubBrowser("?entry=denied");
    const { host, text } = await render(() => Promise.resolve(signedOut));
    expect(assign).not.toHaveBeenCalled();
    expect(stored[ATTEMPTED]).toBeUndefined();
    expect(text()).toContain("That didn't check out — try again or use your dashboard password.");
    expect(host.querySelector("form")).not.toBeNull();
  });

  it("shows only the doors that exist, and says where to go when there are none", async () => {
    stubBrowser("", { [ATTEMPTED]: "1" });
    const passwordOnly = await render(() => Promise.resolve({ authenticated: false, studio_url: null, password_enabled: true }));
    expect(passwordOnly.host.querySelector("a[href]")).toBeNull();
    expect(passwordOnly.host.querySelector("form")).not.toBeNull();

    document.body.innerHTML = "";
    const { assign } = stubBrowser();
    const none = await render(() => Promise.resolve({ authenticated: false, studio_url: null, password_enabled: false }));
    expect(assign).not.toHaveBeenCalled();
    expect(none.host.querySelector("form")).toBeNull();
    expect(none.text()).toContain("opened from the Naive Studio that installed it");
  });

  it("says what went wrong when /api/session itself cannot be reached, rather than a blank page", async () => {
    stubBrowser();
    const { text } = await render(() => Promise.reject(new TypeError("Failed to fetch")));
    expect(text()).not.toBe("");
    expect(text()).not.toContain("The dashboard");
  });
});
