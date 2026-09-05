import { describe, expect, it } from "vitest";
import { submitLead, toLeadInput, type ContactForm } from "./lead.ts";

const form: ContactForm = {
  company: " Summit Outdoor Co ",
  website: "https://summitoutdoor.example/about",
  name: "Jordan Lee",
  email: "jordan@summitoutdoor.example",
  services: ["SEO"],
  note: "Wants a technical audit first.",
};

describe("toLeadInput", () => {
  it("maps the form to the server's LeadInput, normalizing the domain", () => {
    expect(toLeadInput(form)).toEqual({
      name: "Summit Outdoor Co",
      domain: "summitoutdoor.example",
      contact: { name: "Jordan Lee", email: "jordan@summitoutdoor.example", role: "Site inquiry" },
      services: ["SEO"],
      note: "Wants a technical audit first.",
    });
  });

  it("omits empty services and note", () => {
    const input = toLeadInput({ ...form, services: [], note: "  " });
    expect(input).not.toHaveProperty("services");
    expect(input).not.toHaveProperty("note");
  });
});

describe("submitLead", () => {
  const jsonHeaders = new Headers({ "content-type": "application/json" });

  it("returns sent when the dashboard server accepts the lead", async () => {
    const doFetch = (async (url: unknown, init?: RequestInit) => {
      expect(url).toBe("/api/leads");
      expect(JSON.parse(String(init?.body)).name).toBe("Summit Outdoor Co");
      return { ok: true, headers: jsonHeaders } as Response;
    }) as typeof fetch;
    expect(await submitLead(form, doFetch)).toBe("sent");
  });

  it("degrades to offline on a non-ok response", async () => {
    const doFetch = (async () => ({ ok: false, headers: jsonHeaders }) as Response) as typeof fetch;
    expect(await submitLead(form, doFetch)).toBe("offline");
  });

  it("degrades to offline when the server is unreachable", async () => {
    const doFetch = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    expect(await submitLead(form, doFetch)).toBe("offline");
  });
});
