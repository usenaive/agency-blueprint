// @vitest-environment jsdom
/**
 * The five things an agency operator could not do, tested through the screens that now let them.
 *
 * Each block below is a survey finding: there was no way to create a first client from anywhere; a
 * parked approval was invisible; a deliverable was approved from one truncated line; an agent
 * showed neither cost nor history nor why it stopped. These are rendered rather than unit-tested
 * because "the screen offers it" is the whole of the claim — a helper that returns the right value
 * into a screen that never calls it fixes nothing.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { createMemoryRouter, Navigate, RouterProvider } from "react-router";
import { Shell } from "./Shell";
import { AgencyAgents } from "./screens/AgencyAgents";
import { Approvals } from "./screens/Approvals";
import { ClientPosts } from "./screens/ClientPosts";
import { ClientWorkspace } from "./screens/ClientWorkspace";
import { Crm } from "./screens/Crm";

const routes = [
  {
    path: "/",
    Component: Shell,
    children: [
      { index: true, element: <Navigate to="/crm" replace /> },
      { path: "crm", Component: Crm },
      { path: "approvals", Component: Approvals },
      { path: "agents", Component: AgencyAgents },
      { path: "clients/:id", Component: ClientWorkspace, children: [{ path: "posts", Component: ClientPosts }] },
    ],
  },
];

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

const held = {
  tool_call_id: "call_1",
  name: "gmail.send_email",
  args: { to: "owner@acmedental.example", subject: "Your March calendar", body: "Hi Sam,\n\nHere is the calendar." },
};
const parkedSession = {
  id: "ses_1",
  agent_id: "agt_1",
  status: "idle",
  stop_reason: "awaiting_approval",
  pending_actions: [held],
  consumed_micro_usd: 420_000,
};
const roster = { data: [{ id: "agt_1", name: "sales", model: "m", budget: { cap_micro_usd: 10_000_000, max_task_micro_usd: 2_000_000, period: "day" } }] };

/** The default: everything empty, so a test says only what it sets. */
const empty: Router = (path) => ({
  body: path.includes("/api/agents") || path.includes("/api/sessions") || path.includes("/social/") ? { data: [] } : [],
});

describe("the approval queue", () => {
  it("shows the parked call, who proposed it, and the arguments that are the decision", async () => {
    const { text } = await render("/approvals", (path) =>
      path.includes("/api/sessions") ? { body: { data: [parkedSession] } }
      : path.includes("/api/agents") ? { body: roster }
      : { body: [] });

    expect(text()).toContain("sales");
    expect(text()).toContain("gmail.send_email");
    // Not a JSON dump: the address and the message itself are on the screen as text.
    expect(text()).toContain("owner@acmedental.example");
    expect(text()).toContain("Here is the calendar.");
    // Both decisions are words, and each says what it will do. Reject is not an unlabelled icon.
    expect(text()).toMatch(/Approve — run this call/);
    expect(text()).toMatch(/Reject — do not run it/);
  });

  it("names why it is empty when nothing is waiting", async () => {
    const { text } = await render("/approvals", empty);
    expect(text()).toContain("No agent is waiting on you");
  });

  /** The survey caught the reverse of this on another queue: "Nothing pending" over a failed load. */
  it("never renders an empty queue for a request that failed", async () => {
    const { text } = await render("/approvals", (path) =>
      path.includes("/api/sessions") ? { status: 502, body: { error: "upstream unavailable" } }
      : path === "/api/clients" ? { body: [] }
      : { body: { data: [] } });
    expect(text()).not.toContain("No agent is waiting on you");
    expect(text()).toContain("upstream unavailable");
  });

  it("reports the outcome the platform confirmed, and refuses to claim one it did not", async () => {
    const resolved = { ...parkedSession, pending_actions: [] };
    const decided = await render("/approvals", (path, init) =>
      init?.method === "POST" ? { status: 202, body: resolved }
      : path.includes("/api/sessions") ? { body: { data: [parkedSession] } }
      : path === "/api/clients" ? { body: [] }
      : { body: roster });
    await decided.press("Approve —");
    expect(decided.text()).toContain("Approved.");
    expect(decided.calls.some((c) => c.path === "/api/sessions/ses_1/tool_confirmations")).toBe(true);
    const sent = JSON.parse(String(decided.calls.find((c) => c.init?.method === "POST")?.init?.body));
    expect(sent).toEqual({ tool_call_id: "call_1", decision: "allow" });

    document.body.innerHTML = "";
    // Same click, but the platform answers with the call still pending: nothing may be claimed.
    const unresolved = await render("/approvals", (path, init) =>
      init?.method === "POST" ? { status: 202, body: parkedSession }
      : path.includes("/api/sessions") ? { body: { data: [parkedSession] } }
      : path === "/api/clients" ? { body: [] }
      : { body: roster });
    await unresolved.press("Approve —");
    expect(unresolved.text()).toContain("still reports");
    expect(unresolved.text()).not.toContain("Approved.");
  });

  /**
   * The blueprint tells every agent to `ask_operator` for the tool it lacks. That parks the session
   * `awaiting_answer` with a `kind: "question"` row — a different stop reason, a different resolution
   * route — and a queue that only knew `awaiting_approval` showed nothing, so the ask reached nobody.
   */
  it("shows a question the agent asked, and answers it through /answers rather than approving it", async () => {
    const asked = {
      kind: "question",
      tool_call_id: "call_q",
      name: "ask_operator",
      args: { prompt: "The persona has no inbox. Which address should I read as the agency mailbox?" },
      question: {
        prompt: "The persona has no inbox. Which address should I read as the agency mailbox?",
        fields: [
          { key: "address", label: "Mailbox address", type: "text", placeholder: "hello@agency.example" },
          { key: "scope", label: "What to read", type: "choice", options: ["replies only", "everything"], other: false },
        ],
      },
    };
    const parkedQuestion = { ...parkedSession, id: "ses_q", stop_reason: "awaiting_answer", pending_actions: [asked] };
    const answered = { ...parkedQuestion, pending_actions: [] };
    const screen = await render("/approvals", (path, init) =>
      init?.method === "POST" ? { status: 202, body: answered }
      : path.includes("/api/sessions") ? { body: { data: [parkedQuestion] } }
      : path === "/api/clients" ? { body: [] }
      : { body: roster });
    expect(screen.text()).toMatch(/sales\s*asks you/);
    expect(screen.text()).toContain("Which address should I read as the agency mailbox?");
    expect(screen.text()).not.toMatch(/Approve — run this call/);

    // A half-answered question is refused here, before the platform refuses it.
    await screen.press("Answer —");
    expect(screen.text()).toContain("Answer every field before sending: Mailbox address, What to read.");
    expect(screen.calls.some((c) => c.init?.method === "POST")).toBe(false);

    await screen.type("hello@agency", "hello@agency.example");
    await screen.press("replies only");
    await screen.press("Answer —");
    expect(screen.text()).toContain("Answered. sales has your answer");
    const sent = screen.calls.find((c) => c.init?.method === "POST");
    expect(sent?.path).toBe("/api/sessions/ses_q/answers");
    expect(JSON.parse(String(sent?.init?.body))).toEqual({
      tool_call_id: "call_q",
      answers: { address: "hello@agency.example", scope: "replies only" },
    });
  });

  it("is on the rail with a count, so a parked agent is visible from every screen", async () => {
    const { text } = await render("/crm", (path) =>
      path.includes("/api/sessions") ? { body: { data: [parkedSession] } } : { body: [] });
    expect(text()).toContain("Approvals");
  });
});

describe("the CRM's first client", () => {
  it("offers a first action on an empty board and files it through the leads route", async () => {
    const filed: unknown[] = [];
    const created = { id: "cli_1", slug: "acme-dental", name: "Acme Dental", domain: "acmedental.example", stage: "lead", services: [], contact: { name: "Jordan Lee", email: "jordan@acmedental.example", role: "" }, notes: [] };
    const screen = await render("/crm", (path, init) => {
      if (path === "/api/leads" && init?.method === "POST") {
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
    }]);
    // And the board takes the row the server answered with, rather than one it drew itself.
    expect(screen.text()).toContain("Acme Dental");
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

describe("an agent", () => {
  const sessions = {
    data: [
      { id: "ses_9", agent_id: "agt_1", status: "idle", stop_reason: "budget_paused", consumed_micro_usd: 2_000_000, created_at: "2025-03-04T00:00:00Z" },
    ],
  };

  it("shows what it costs, what it has done, and why it last stopped", async () => {
    const screen = await render("/agents", (path) =>
      path.startsWith("/api/agents/agt_1/spend") ? { body: { period: "day", spent_micro_usd: 3_500_000 } }
      : path.startsWith("/api/agents") ? { body: roster }
      : path.startsWith("/api/sessions") ? { body: sessions }
      : { body: [] });

    // The cap the agent carries, and the reason its last session stopped — neither was ever shown.
    expect(screen.text()).toContain("$10.00 / day");
    expect(screen.text()).toContain("Paused — out of budget");
    expect(screen.text()).toContain("1 session");

    await screen.press("sales");
    expect(screen.text()).toContain("$3.50");
    expect(screen.text()).toContain("Spent this day");
  });

  it("says its spend is unavailable rather than printing a zero it did not read", async () => {
    const screen = await render("/agents", (path) =>
      path.startsWith("/api/agents/agt_1/spend") ? { status: 502, body: { error: "upstream unavailable" } }
      : path.startsWith("/api/agents") ? { body: roster }
      : path.startsWith("/api/sessions") ? { body: sessions }
      : { body: [] });
    await screen.press("sales");
    expect(screen.text()).toContain("Spend unavailable");
    expect(screen.text()).not.toContain("$0.00");
  });
});
