/**
 * THE ONE FILE TO EDIT. Every string and colour on the public site renders from this object —
 * personalizing it to your agency is a single-file rewrite (the README carries a paste-ready
 * prompt for an agent to do it). Components never hard-code copy; they read `site` and nothing
 * else.
 *
 * What the agency *does* is not written here twice: the hero, the services and the footer are the
 * active template's (`templates/index.ts`), so the public site sells the same specialism the
 * dashboard runs, and switching template changes both. Everything below that — your name, your
 * palette, your process and your prices — is yours, and is template-neutral on purpose.
 *
 * One rule that is not about taste: `caseStudies.items` and `testimonials.items` ship **empty**,
 * and the page tells visitors so. A case study is a factual claim about someone else's business
 * and a testimonial is words in a named person's mouth, so this template carries neither — an
 * unedited deploy must never publish client work nobody did. Add entries only from engagements
 * you actually ran and quotes a client actually gave you.
 */

import { ACTIVE } from "../templates/index.ts";

export interface Service {
  name: string;
  headline: string;
  description: string;
  deliverables: string[];
}

export interface ProcessStep {
  title: string;
  description: string;
}

/**
 * A real engagement, published with the client's sign-off. The template ships none: a case study
 * is a factual claim about someone else's business, so there is nothing honest to put here until
 * the agency has one. See `caseStudies.empty` for what the page says in the meantime.
 */
export interface CaseStudy {
  client: string;
  industry: string;
  headline: string;
  result: string;
  metrics: { label: string; value: string }[];
}

/** A quote a named person actually gave you. Ships empty for the same reason case studies do. */
export interface Testimonial {
  quote: string;
  name: string;
  role: string;
}

export interface PricingTier {
  name: string;
  price: string;
  cadence: string;
  blurb: string;
  includes: string[];
  featured?: boolean;
}

export interface SiteConfig {
  company: string;
  tagline: string;
  /** One sentence of voice guidance for whoever (or whatever) rewrites the copy. */
  tone: string;
  /** The site's whole colour budget; everything else is ink on paper. */
  palette: { accent: string; accentInk: string; ground: string; ink: string; muted: string };
  hero: { eyebrow: string; title: string; subtitle: string; cta: string; secondaryCta: string };
  services: Service[];
  process: { title: string; subtitle: string; steps: ProcessStep[] };
  /** `empty` is what a visitor reads while `items` is empty — say nothing you cannot stand behind. */
  caseStudies: { title: string; empty: string; items: CaseStudy[] };
  testimonials: { title: string; empty: string; items: Testimonial[] };
  pricing: { title: string; subtitle: string; tiers: PricingTier[] };
  contact: { title: string; subtitle: string; email: string; offlineNote: string };
  footer: { note: string };
}

export const site: SiteConfig = {
  company: ACTIVE.words.brand,
  tagline: ACTIVE.site.tagline,
  tone: "Confident, plain-spoken, evidence-first. No jargon, no hype.",
  palette: { accent: "#1d4ed8", accentInk: "#ffffff", ground: "#fbfaf8", ink: "#111114", muted: "#63605a" },
  hero: {
    eyebrow: ACTIVE.site.eyebrow,
    title: ACTIVE.site.title,
    subtitle: ACTIVE.site.subtitle,
    cta: ACTIVE.site.cta,
    secondaryCta: "See how we work",
  },
  services: ACTIVE.site.services,
  process: {
    title: "How an engagement runs",
    subtitle: "Four steps, no mystery. You see every deliverable before it ships.",
    steps: [
      { title: "Baseline", description: "We measure where you stand today, in the first two weeks, and write it down." },
      { title: "Plan", description: "A quarter's roadmap: the calendar, the deliverables and the fixes ordered by impact." },
      { title: "Ship", description: "Work goes out weekly. Everything passes through your approval queue first." },
      { title: "Prove", description: "Monthly reports tie the work to what moved — not vanity metrics." },
    ],
  },
  /**
   * Empty on purpose. Fill `items` with engagements you actually ran, and only with the client's
   * permission — an unedited deploy must never show a visitor a result nobody achieved.
   */
  caseStudies: {
    title: "Client results",
    empty: "No case studies published yet.",
    items: [],
  },
  /** Empty on purpose: a quote goes here only when a named person actually gave you one. */
  testimonials: {
    title: "What clients say",
    empty: "No client quotes published yet.",
    items: [],
  },
  pricing: {
    title: "Plain pricing",
    subtitle: "Month to month after the first quarter. Every plan starts with the baseline.",
    tiers: [
      {
        name: "Foundation",
        price: "$2,500",
        cadence: "/month",
        blurb: "For teams that need the base fixed and a steady cadence of work started.",
        includes: ["Quarterly audit", "4 deliverables / month", "On-page fixes", "Monthly report"],
      },
      {
        name: "Growth",
        price: "$6,000",
        cadence: "/month",
        blurb: "The full engagement — the whole calendar shipped and reported every month.",
        includes: ["Everything in Foundation", "12 deliverables / month", "Full channel coverage", "Dedicated strategist"],
        featured: true,
      },
      {
        name: "Partner",
        price: "Custom",
        cadence: "",
        blurb: "Multi-site or multi-market programs with embedded reporting.",
        includes: ["Everything in Growth", "Multi-domain programs", "Custom dashboards", "Quarterly on-site planning"],
      },
    ],
  },
  contact: {
    title: ACTIVE.site.cta,
    subtitle: ACTIVE.site.contactSubtitle,
    email: "hello@your-agency.example",
    offlineNote: "Couldn't reach our inbox just now — email us directly and we'll take it from there.",
  },
  footer: { note: ACTIVE.site.footerNote },
};
