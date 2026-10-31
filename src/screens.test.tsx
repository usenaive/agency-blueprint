// @vitest-environment jsdom
/**
 * Each primitive app's screen (ADR-1766), rendered rather than unit-tested because "the screen
 * offers it" is the whole of the claim. There is no agency shell: the Studio draws the rail,
 * approvals and agents, so what is tested here is what each app itself shows and does.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router";
import { ClientPosts } from "./screens/ClientPosts";
import { ClientWorkspace, WorkClient } from "./screens/ClientWorkspace";
import { SCREENS } from "./apps";
import { TEMPLATE } from "./data";
import { site as holding } from "../site/site.config";

const routes = [
  {
    path: "/",
    Component: Outlet,
    children: [
      { path: "crm", Component: SCREENS.crm.Component },
      { path: "site", Component: SCREENS["landing-page"].Component },
      { path: "seo", Component: SCREENS["seo-geo"].Component },
      { path: "ads", Component: SCREENS.ads.Component },
      { path: "clients/:id", Component: ClientWorkspace, children: [{ path: "posts", Component: ClientPosts }] },
      { path: "work/:id", Component: WorkClient, children: [{ index: true, Component: ClientPosts }] },
    ],
  },
];

describe("the landing page, SEO & GEO and Ads apps, on every template", () => {
  const filed = (app: "seo-geo" | "ads" | "landing-page") => TEMPLATE.kinds.filter((k) => k.app === app).map((k, i) => ({
    id: `post_${app}${i}`, clientId: "cli_1", clientName: "Acme", title: `${k.label} for Acme`, summary: "s", kind: k.id, channel: "blog", status: "pending", agent: "a", scheduledFor: "2026-11-01", hue: 0,
  }));
  const api = (posts: unknown[], clients: unknown[] = []) => (path: string) =>
    path === "/api/site" ? { body: holding } : path === "/api/posts" ? { body: posts } : path === "/api/clients" ? { body: clients }
      : path === "/api/accounts" ? { body: { data: [{ connector: "google-search-console", status: "connected" }, { connector: "meta-ads", status: "connected" }] } }
      : { body: [] };

  it("checks the agency's own site, lists its contact-form leads, and its blog", async () => {
    const lead = { id: "cli_9", slug: "pine", name: "Pine & Post", domain: "pine.example", stage: "lead", services: [], contact: { name: "A", email: "a@pine.example", role: "" }, notes: [] };
    const screen = await render("/site", api(filed("landing-page"), [lead, { ...lead, id: "cli_8", name: "Filed Co", filed: true }]));
    expect(screen.text()).toContain("Your profile is live, not the holding page");
    expect(screen.text()).toContain("Pine & Post");
    expect(screen.text()).toContain("Waiting for sales");
    expect(screen.text()).toContain("In the CRM");
  });

  it("lists the template's search work by the client it was filed for", async () => {
    const posts = filed("seo-geo");
    const screen = await render("/seo", api(posts));
    expect(screen.text()).toContain("Google Search Console connected");
    for (const post of posts) expect(screen.text()).toContain(post.title);
    if (posts.length > 0) expect(screen.text()).toContain("Acme");
    if (posts.length === 0) expect(screen.text()).toContain("files no search deliverables");
  });

  it("lists connected ad accounts and the template's ad work, or says no seat writes ads", async () => {
    const posts = filed("ads");
    const screen = await render("/ads", api(posts));
    expect(screen.text()).toContain("meta-ads");
    for (const post of posts) expect(screen.text()).toContain(post.title);
    if (posts.length === 0) expect(screen.text()).toContain("No agent in this template writes ads");
  });

  it("opens one client's work in an app that does not hold the CRM, by the name it was filed under", async () => {
    const post = { id: "post_1", clientId: "cli_1", clientName: "Acme", title: "Ad concept", summary: "s", body: "The whole concept.", kind: "campaign-concept", channel: "blog", status: "pending", agent: "a", scheduledFor: "2026-11-01", hue: 0 };
    const screen = await render("/work/cli_1", (path) => ({ body: path.startsWith("/api/posts") ? [post] : [] }));
    expect(screen.text()).toContain("Acme");
    await screen.press("Read and decide");
    expect(screen.text()).toContain("The whole concept.");
  });
});

/** React only batches inside `act` when it is told it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Reply = { status?: number; body: unknown };
type Router = (path: string, init: RequestInit | undefined) => Reply;

async function render(at: string, route: Router) {
  const calls: { path: string; init: RequestInit | undefined }[] = [];
  vi.stubGlobal("sessionStorage", {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  });
  vi.stubGlobal("fetch", ((url: string, init?: RequestInit) => {
    calls.push({ path: String(url), init });
    const { status = 200, body } = route(String(url), init);
    return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
  }) as unknown as typeof fetch);

  const host = document.createElement("div");
  document.body.append(host);
  await act(async () => {
    createRoot(host).render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [at] })} />);
  });
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });

  const text = () => (host.textContent ?? "").replace(/\s+/g, " ").trim();
  const button = (label: string) =>
    [...host.querySelectorAll("button")].find((b) => (b.textContent ?? "").includes(label));
  const press = async (label: string) => {
    const target = button(label);
    if (!target) throw new Error(`no button matching ${JSON.stringify(label)} in: ${text()}`);
    await act(async () => { target.click(); });
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  };
  const type = async (placeholder: string, value: string) => {
    const field = host.querySelector<HTMLInputElement>(`input[placeholder^="${placeholder}"]`);
    if (!field) throw new Error(`no field placed ${JSON.stringify(placeholder)} in: ${text()}`);
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => {
      setter.call(field, value);
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };
  return { host, text, button, press, type, calls };
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("the CRM's first client", () => {
  it("offers a first action on an empty board and files it through the CRM's own route", async () => {
    const filed: unknown[] = [];
    const created = { id: "cli_1", slug: "acme-dental", name: "Acme Dental", domain: "acmedental.example", stage: "lead", services: [], contact: { name: "Jordan Lee", email: "jordan@acmedental.example", role: "" }, notes: [] };
    const screen = await render("/crm", (path, init) => {
      if (path === "/api/clients" && init?.method === "POST") {
        filed.push(JSON.parse(String(init.body)));
        return { status: 201, body: created };
      }
      return { body: path.includes("/api/sessions") ? { data: [] } : [] };
    });

    expect(screen.text()).toContain("Add your first client");
    await screen.press("Add your first client");
    await screen.type("Acme Dental", "Acme Dental");
    await screen.type("acmedental.example", "acmedental.example");
    await screen.type("Jordan Lee", "Jordan Lee");
    await screen.type("jordan@acmedental.example", "jordan@acmedental.example");
    await screen.press("File as a lead");

    expect(filed).toEqual([{
      name: "Acme Dental",
      domain: "acmedental.example",
      contact: { name: "Jordan Lee", email: "jordan@acmedental.example", role: "" },
      source: "manual",
    }]);
    // And the board takes the row the server answered with, rather than one it drew itself.
    expect(screen.text()).toContain("Acme Dental");
  });

  it("says where each lead came from, and who referred it", async () => {
    const row = (id: string, name: string, extra: Record<string, unknown>) =>
      ({ id, slug: id, name, domain: `${id}.example`, stage: "lead", services: [], contact: { name: "C", email: `c@${id}.example`, role: "" }, notes: [], ...extra });
    const clients = [
      row("cli_a", "Acme Dental", { stage: "active", source: "site" }),
      row("cli_b", "Bayside Ortho", { source: "referral", referredBy: "cli_a" }),
      row("cli_c", "Cedar Legal", { source: "network" }),
      row("cli_d", "Old Row Inc", {}),
    ];
    const screen = await render("/crm", (path) => ({ body: path === "/api/clients" ? clients : path.includes("/api/sessions") ? { data: [] } : [] }));
    expect(screen.text()).toContain("via website");
    expect(screen.text()).toContain("referred by Acme Dental");
    expect(screen.text()).toContain("via your network");
    // A row filed before sources existed carries no chip, rather than a guess.
    expect(screen.text()).not.toContain("via outreach");
  });
});

describe("a deliverable, before it is approved", () => {
  const post = {
    id: "post_1", clientId: "cli_1", title: "Invisalign vs braces", summary: "One line about it.",
    body: "# Invisalign vs braces\n\nThe whole piece, as the agent wrote it.",
    kind: "article", channel: "blog", status: "pending", agent: "seo-writer--acme", scheduledFor: "2025-03-04", hue: 10,
  };
  const client = { id: "cli_1", slug: "acme", name: "Acme", domain: "acme.example", stage: "active", services: [], contact: { name: "S", email: "s@acme.example", role: "Owner" }, notes: [] };
  const route: Router = (path) =>
    path.startsWith("/api/posts") ? { body: [post] }
    : path === "/api/clients" ? { body: [client] }
    : { body: { data: [] } };

  it("cannot be approved from the list — the decision lives with the draft", async () => {
    const screen = await render("/clients/cli_1/posts", route);
    expect(screen.text()).toContain("Read and decide");
    expect(screen.button("Approve —")).toBeUndefined();
  });

  it("shows the draft in full once opened", async () => {
    const screen = await render("/clients/cli_1/posts", route);
    await screen.press("Read and decide");
    expect(screen.text()).toContain("The whole piece, as the agent wrote it.");
    expect(screen.text()).toContain("Approve — clear it to publish");
  });

  it("says a draft has no body rather than implying the line was the piece", async () => {
    const { body: _dropped, ...noBody } = post;
    const screen = await render("/clients/cli_1/posts", (path) =>
      path.startsWith("/api/posts") ? { body: [noBody] }
      : path === "/api/clients" ? { body: [client] }
      : { body: { data: [] } });
    await screen.press("Read and decide");
    expect(screen.text()).toContain("filed no draft body");
  });
});

describe("onboarding a client, through the CEO (ADR-1766)", () => {
  const proposal = { id: "cli_1", slug: "acme", name: "Acme", domain: "acme.example", stage: "proposal", services: [], contact: { name: "S", email: "s@acme.example", role: "Owner" }, notes: [] };
  const draft = "Onboard Acme (cli_1) from the CRM: read crm.get_client_crew for cli_1, …";

  it("opens the CEO's chat with the request typed when the platform names a studio", async () => {
    const opened = vi.fn();
    vi.stubGlobal("open", opened);
    const screen = await render("/crm", (path, init) =>
      path === "/api/clients/cli_1/onboard" && init?.method === "POST" ? { body: { client: { ...proposal, onboardingRequestedAt: "now" }, draft, url: "https://studio.test/orchestrator?new=1" } }
      : { body: path === "/api/clients" ? [proposal] : [] });
    await screen.press("Move to active");
    expect(screen.calls.filter((c) => c.init?.method === "POST").map((c) => c.path)).toEqual(["/api/clients/cli_1/onboard"]);
    expect(opened).toHaveBeenCalledWith("https://studio.test/orchestrator?new=1", "_top");
    // The card says the request is with the CEO, rather than offering the move again.
    expect(screen.text()).toContain("Team requested: waiting on your CEO's hires.");
    expect(screen.button("Move to active")).toBeUndefined();
  });

  it("shows the request to send where there is no studio to open", async () => {
    const screen = await render("/crm", (path, init) =>
      path === "/api/clients/cli_1/onboard" && init?.method === "POST" ? { body: { client: proposal, draft, url: null } }
      : { body: path === "/api/clients" ? [proposal] : [] });
    await screen.press("Move to active");
    expect(screen.text()).toContain("Ask your CEO to hire this client's team");
    expect(screen.text()).toContain(draft);
  });
});
