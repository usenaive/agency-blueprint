import { describe, expect, it } from "vitest";
import { TEMPLATES } from "../templates/active";
import { AGENCY_IDENTITY } from "../templates/blank";
import { clientCrew, onboardDraft } from "./crew";

const ACME = { id: "cli_1", name: "Acme", slug: "acme", domain: "acme.test" };

describe("clientCrew — what the CEO hires for one client (ADR-1766)", () => {
  it("names each seat for the client and keeps the handoff chain inside its team", () => {
    const crew = TEMPLATES["seo-geo"].crew;
    const got = clientCrew(ACME, crew, []);
    if (!got.ok) throw new Error(got.reason);
    expect(got.create.map((a) => [a.name, a.handoffs])).toEqual([
      ["seo-writer--acme", ["geo-optimizer--acme"]],
      ["geo-optimizer--acme", false],
      ["audit-runner--acme", ["seo-writer--acme"]],
    ]);
    // Everything else is the template's, verbatim; the persona is a grant of its own, never a body field.
    for (const [i, body] of got.create.entries()) {
      expect(body.system).toBe(crew[i]?.system);
      expect(body.model).toBe(crew[i]?.model);
      expect(body).not.toHaveProperty("identity");
    }
    expect(got.identity).toBe(AGENCY_IDENTITY);
  });

  it("locks a crew browser to the client's own domain", () => {
    const got = clientCrew(ACME, TEMPLATES.security.crew, []);
    if (!got.ok) throw new Error(got.reason);
    expect(got.create.map((a) => a.tools?.configs?.browser?.config?.allowed_domains)).toEqual([["acme.test"], ["acme.test"]]);
  });

  it("refuses a client with no domain when a seat's browser is limited to the client's site", () => {
    expect(clientCrew({ ...ACME, domain: " " }, TEMPLATES.security.crew, [])).toEqual({
      ok: false,
      reason: "Acme has no domain, and this team's browser is limited to the client's own site",
    });
  });

  it("lists a seat the client already has instead of hiring it twice", () => {
    const got = clientCrew(ACME, TEMPLATES.security.crew, ["customer-tester--acme", "other--acme"]);
    if (!got.ok) throw new Error(got.reason);
    expect(got.create.map((a) => a.name)).toEqual(["edge-tester--acme"]);
    expect(got.existing).toEqual(["customer-tester--acme"]);
  });

  it("is nothing to hire for a template with no per-client team", () => {
    expect(clientCrew(ACME, TEMPLATES.blank.crew, [])).toEqual({ ok: true, create: [], existing: [], identity: null });
  });
});

describe("onboardDraft — the sentence the CEO chat opens with", () => {
  const sentence = "Onboard Acme (cli_1) from the CRM: read crm.get_client_crew for cli_1, hire each agent it lists exactly as written, give each the identity it names, then call crm.record_onboarding with their ids.";

  it("links the studio's CEO chat with the sentence typed and nothing sent", () => {
    expect(onboardDraft(ACME, "https://studio.test/")).toEqual({
      draft: sentence,
      url: `https://studio.test/orchestrator?${new URLSearchParams({ new: "1", draft: sentence })}`,
    });
  });

  it("has no link where the platform names no studio", () => {
    expect(onboardDraft(ACME, undefined)).toEqual({ draft: sentence, url: null });
  });
});
