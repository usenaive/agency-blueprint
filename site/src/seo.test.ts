// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { site } from "../site.config.ts";
import { applySeo } from "./seo.ts";

describe("public-site SEO metadata", () => {
  it("writes canonical, social and structured metadata from the approved profile", () => {
    const profile = {
      ...site,
      company: "Founder Frame",
      tagline: "Be the answer",
      contact: { ...site.contact, email: "hello@founderframehq.com" },
    };
    applySeo(profile, "https://founderframehq.com/anything");

    expect(document.title).toBe("Founder Frame — Be the answer");
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe("https://founderframehq.com/");
    expect(document.querySelector('meta[property="og:title"]')?.getAttribute("content")).toBe(document.title);
    expect(document.querySelector('meta[name="description"]')?.getAttribute("content")).toBe(profile.hero.subtitle);
    expect(document.querySelector("#agency-structured-data")?.textContent).toContain("hello@founderframehq.com");
    expect(document.querySelector("#agency-structured-data")?.textContent).toContain("FAQPage");
  });
});
