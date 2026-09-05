/**
 * The judgements the approval queue and the Agents screen make about a platform row. They are here
 * rather than in a rendered screen because each one is a *claim about the platform's contract*, and
 * a claim is what can be wrong.
 */
import { describe, expect, it } from "vitest";
import { argRows, parked, stopLabel, usd, waitingOn, type PlatformSession } from "./platform";

const session = (over: Partial<PlatformSession> = {}): PlatformSession => ({
  id: "ses_1",
  agent_id: "agt_1",
  status: "idle",
  stop_reason: null,
  pending_actions: [],
  ...over,
});

const held = { tool_call_id: "call_1", name: "gmail.send_email", args: { to: "ops@acme.example" } };

describe("parked", () => {
  /**
   * The bug this exists for: `awaiting_approval` is a stop *reason*, and the session's status is
   * `idle`. A screen looking for a status of that name finds nothing, which is why a parked
   * approval reached the operator as silence.
   */
  it("is the idle session whose stop reason is awaiting_approval, not a status", () => {
    expect(parked(session({ stop_reason: "awaiting_approval", pending_actions: [held] }))).toBe(true);
    expect(parked(session({ status: "awaiting_approval", pending_actions: [held] }))).toBe(false);
  });

  it("is not an idle session that finished, nor one parked with nothing to decide", () => {
    expect(parked(session({ stop_reason: "end_turn", pending_actions: [held] }))).toBe(false);
    expect(parked(session({ stop_reason: "awaiting_approval" }))).toBe(false);
  });
});

describe("waitingOn", () => {
  it("names the agent behind each held call, and falls back to its id rather than to nothing", () => {
    const rows = waitingOn(
      [
        session({ id: "ses_1", agent_id: "agt_1", stop_reason: "awaiting_approval", pending_actions: [held] }),
        session({ id: "ses_2", agent_id: "agt_2", stop_reason: "awaiting_approval", pending_actions: [held] }),
        session({ id: "ses_3", stop_reason: "end_turn" }),
      ],
      new Map([["agt_1", "sales"]]),
    );
    expect(rows.map((r) => [r.session.id, r.agent])).toEqual([
      ["ses_1", "sales"],
      ["ses_2", "agt_2"],
    ]);
  });

  it("lists every held call of a session, not just the first", () => {
    const two = [held, { tool_call_id: "call_2", name: "gmail.send_email", args: {} }];
    const rows = waitingOn([session({ stop_reason: "awaiting_approval", pending_actions: two })], new Map());
    expect(rows.map((r) => r.action.tool_call_id)).toEqual(["call_1", "call_2"]);
  });
});

describe("argRows", () => {
  /** The arguments are the thing being approved, so they are read, not dumped. */
  it("shows a value as what it is, and reserves JSON for what is genuinely nested", () => {
    expect(
      argRows({
        to: "owner@acme.example",
        body: "Hi Sam,\n\nHere is the proposal.",
        count: 3,
        draft: false,
        platforms: ["linkedin", "x"],
        thread: { id: "t_1", replies: [1] },
      }),
    ).toEqual([
      { key: "to", value: "owner@acme.example", block: false },
      { key: "body", value: "Hi Sam,\n\nHere is the proposal.", block: true },
      { key: "count", value: "3", block: false },
      { key: "draft", value: "false", block: false },
      { key: "platforms", value: "linkedin, x", block: false },
      { key: "thread", value: '{\n  "id": "t_1",\n  "replies": [\n    1\n  ]\n}', block: true },
    ]);
  });

  it("gives a long single-line string its own lines rather than truncating it", () => {
    const [row] = argRows({ subject: "x".repeat(100) });
    expect(row).toEqual({ key: "subject", value: "x".repeat(100), block: true });
  });
});

describe("usd", () => {
  it("reads micro-USD, and keeps a small figure from rounding to zero", () => {
    expect(usd(10_000_000)).toBe("$10.00");
    expect(usd(0)).toBe("$0.00");
    expect(usd(1_250)).toBe("$0.0013");
  });
});

describe("stopLabel", () => {
  /**
   * Stopping for any reason other than finishing used to show nothing at all, so an agent out of
   * budget and an agent that finished looked identical.
   */
  it("says why every stop happened, including the ones that are not success", () => {
    expect(stopLabel(session({ stop_reason: "end_turn" }))).toBe("Finished");
    expect(stopLabel(session({ stop_reason: "budget_paused" }))).toBe("Paused — out of budget");
    expect(stopLabel(session({ stop_reason: "error" }))).toBe("Stopped on an error");
    expect(stopLabel(session({ stop_reason: "context_exhausted" }))).toBe("Stopped — the turn produced nothing");
  });

  it("prints a reason it has no word for, and a session that has not stopped", () => {
    expect(stopLabel(session({ stop_reason: "a_reason_added_later" }))).toBe("a_reason_added_later");
    expect(stopLabel(session({ status: "running" }))).toBe("Running");
    expect(stopLabel(session({ status: "queued" }))).toBe("Queued");
  });
});
