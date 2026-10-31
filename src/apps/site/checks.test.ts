import { describe, expect, it } from "vitest";
import { site } from "../../../site/site.config";
import { siteChecks } from "./checks";

const live = { ...site, company: "Acme Search", tagline: "Found in search and in answers" };
const byLabel = (checks: ReturnType<typeof siteChecks>) => Object.fromEntries(checks.map((c) => [c.label, c.done]));

describe("siteChecks", () => {
  it("fails the holding page, and passes a profile that names a company", () => {
    expect(byLabel(siteChecks(site, site.company, 0))["Your profile is live, not the holding page"]).toBe(false);
    expect(byLabel(siteChecks(live, site.company, 0))["Your profile is live, not the holding page"]).toBe(true);
  });

  it("holds the title and description to the lengths a result shows", () => {
    const long = { ...live, tagline: "x".repeat(80), hero: { ...live.hero, subtitle: "too short" } };
    const checks = byLabel(siteChecks(long, site.company, 0));
    expect(checks["Title fits a search result"]).toBe(false);
    expect(checks["Description fits a search result"]).toBe(false);
  });

  it("asks for three quotable answers and one live article", () => {
    const thin = { ...live, faq: { ...live.faq, items: live.faq.items.slice(0, 2) } };
    expect(byLabel(siteChecks(thin, site.company, 0))).toMatchObject({ "Answers AI assistants can quote": false, "Published articles": false });
    const full = { ...live, faq: { ...live.faq, items: [...Array(3)].map((_, i) => ({ question: `q${i}`, answer: "a" })) } };
    expect(byLabel(siteChecks(full, site.company, 2))).toMatchObject({ "Answers AI assistants can quote": true, "Published articles": true });
  });
});
