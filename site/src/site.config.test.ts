/**
 * The public site is a template, and it shipped with its Work and Testimonials sections already
 * full: three case studies with result metrics, and two quotes signed by named people at named
 * companies. None of it was real. A customer who runs `naive up` and never opens
 * `site.config.ts` publishes those as claims about their own business — invented client outcomes
 * and invented human endorsements, on a live public page.
 *
 * So the rule is not about wording: the template carries **no** client outcome and **no** human
 * endorsement, and the rendered page says plainly that there are none yet.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { isValidElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { site } from "../site.config.ts";
import { CaseStudies, Pricing, Testimonials } from "./sections.tsx";

/** Everything a visitor would read, flattened out of a section's element tree. */
function render(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (Array.isArray(node)) return node.map(render).join(" ");
  if (!isValidElement(node)) return String(node);
  const props = node.props as { children?: ReactNode };
  return typeof node.type === "function"
    ? render((node.type as (p: unknown) => ReactNode)(node.props))
    : render(props.children);
}

describe("the site template invents no social proof", () => {
  it("ships no case study and no testimonial", () => {
    expect(site.caseStudies.items).toEqual([]);
    expect(site.testimonials.items).toEqual([]);
  });

  it("tells a visitor there are none rather than showing invented ones", () => {
    const work = render(CaseStudies());
    const quotes = render(Testimonials());
    expect(work).toContain(site.caseStudies.empty);
    expect(quotes).toContain(site.testimonials.empty);
    // No result metric anyone could read as an outcome, and no attributed quote.
    expect(work).not.toMatch(/\d/);
    expect(quotes).not.toMatch(/[“”]/);
  });

  it("is actually reading the rendered page", () => {
    // A `render` that returned "" would satisfy both assertions above and prove nothing.
    expect(render(Pricing())).toContain(site.pricing.tiers[0]?.price ?? "unset");
  });

  /**
   * The README's paste-ready personalization prompt used to ask an agent for "2–3 plausible
   * engagements … a concrete result metric". A prompt that asks a model to invent client outcomes
   * puts them on the customer's live site just as surely as shipping them in the config does.
   */
  it("ships no prompt that asks an agent to make client work up", () => {
    const readme = readFileSync(fileURLToPath(new URL("../../README.md", import.meta.url)), "utf8");
    expect(readme).not.toMatch(/plausible/i);
    expect(readme).toMatch(/Invent nothing/);
    expect(readme).not.toMatch(/Acme Dental|Priya Shah|Verdant Skincare|Northbeam Legal/);
  });
});
