/** The committed config must load and validate through the real `naive up` loader. */
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "@usenaive-sdk/blueprints";
import { TEMPLATES } from "./templates/active.ts";
import { TEMPLATE } from "./templates/index.ts";

describe("naive.config.ts", () => {
  it("loads and validates via loadConfig", async () => {
    const result = await loadConfig(dirname(fileURLToPath(import.meta.url)));
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    // The blueprint is the machine and the project is named for it; the template is the data that
    // fills it, and it is declared so the platform records which one was applied.
    expect(result.config.name).toBe("agency");
    expect(result.config.blueprint).toBe("agency");
    expect(result.config.template).toBe(TEMPLATE);
    // One repo carries every template of its blueprint — that is what makes a switch an edit and
    // never a re-clone, and `defineProject` refuses a repo that carries only some.
    expect(Object.keys(TEMPLATES).sort()).toEqual(["blank", "seo-geo"]);
    expect(result.config.apps.map((a) => a.name)).toEqual(["dashboard", "site"]);
    // Only the dashboard serves MCP; the frontend-only site has no server to answer on one.
    expect(result.config.apps.map((a) => a.mcp)).toEqual(["/mcp", undefined]);
    // Without the key on the app itself the deployed process has none: the chat relay and the
    // per-client crew provisioning cannot work at all, and every platform route answers 503.
    expect(result.config.apps[0].env).toMatchObject({ NAIVE_API_KEY: { from_env: "NAIVE_API_KEY" } });
    // The `/api/*` gate. Required, not optional: the CRM holds client contacts and their email
    // addresses and the queue is writable, so an apply that cannot read a token must refuse rather
    // than deploy a dashboard anyone who finds the URL can read and mutate.
    expect(result.config.apps[0].env).toMatchObject({ DASHBOARD_TOKEN: { from_env: "DASHBOARD_TOKEN" } });
    // The optional two are literals and only when set — a `{ from_env }` on an unset optional
    // variable would refuse the whole apply.
    // `?? {}`: the variable is normally unset (it is in CI), so the key is absent and
    // `toHaveProperty` on `undefined` throws before it can assert anything.
    expect(result.config.apps[0].env?.NAIVE_API_URL ?? {}).not.toHaveProperty("from_env");
    // The agents are the chosen template's, folded in by `defineProject` — the config declares none
    // of its own, so switching template is the only thing that changes this list.
    expect(result.config.agents.map((a) => a.name)).toEqual(TEMPLATES[TEMPLATE].agents.map((a) => a.name));
    expect(result.config.agents.map((a) => a.name)).toEqual(["sales", "client-manager"]);
    for (const agent of result.config.agents) {
      expect(agent.system).toMatch(/never send or publish anything yourself/);
      expect(agent.system).toMatch(/dashboard tools/);
      expect(agent.tools?.default_config.permission).toBe("deny");
      // Deny-by-default drops unlisted tools, so the dashboard's MCP tools must be named to be usable.
      expect(Object.keys(agent.tools?.configs ?? {})).toContain("dashboard.create_draft_post");
      expect(agent.tools?.configs).not.toHaveProperty("dashboard.approve_post");
      // Nothing publishes: the platform's own publishing tool is not granted, and the dashboard's
      // queue is where a deliverable waits instead. The README's "nothing publishes without you" is
      // this line, not a prompt.
      expect(agent.tools?.configs).not.toHaveProperty("social.post");
      expect(Object.keys(agent.tools?.configs ?? {}).filter((name) => name.startsWith("social."))).toEqual([]);
      // The client's connected accounts do reach the agent, as `<connector>.<tool>`, because
      // deny-by-default means an unnamed connection tool is a connection the crew cannot use at
      // all. Reads run; the one outward act — sending — is `ask`, so the call parks the session and
      // waits for the operator on the dashboard's Approvals screen instead of leaving.
      expect(agent.tools?.configs["gmail.fetch_emails"]).toEqual({ enabled: true, permission: "allow" });
      expect(agent.tools?.configs["gmail.send_email"]).toEqual({ enabled: true, permission: "ask" });
    }
    expect(result.config.agents[0].tools?.configs).toHaveProperty("dashboard.create_lead");
    expect(result.config.agents[1].tools?.configs).toHaveProperty("dashboard.get_calendar");
    expect(result.config.agents[1].schedules?.map((s) => s.cron)).toEqual(["0 8 * * 1"]);
    // Both templates declare the same pair, so a switch narrows nothing here and `kept` is empty.
    // The part that does differ — the per-client crew — is `server/proxy.ts`'s, because its names
    // carry a client slug and cannot be declared statically.
    expect(result.config.kept.agents).toEqual([]);
    // jiti compiles the config cold on a fresh CI runner; the default 5s is not enough.
  }, 30_000);
});
