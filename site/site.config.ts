/**
 * THE SEED OF THE PUBLIC SITE. The site is data: this object is the `site_profile` record the
 * dashboard store is created with (once, for the active template), the public site renders
 * whatever `GET /api/site` answers, and the site-builder agent rewrites it from the setup answers
 * through `dashboard.update_site` — every change waiting for the operator's approval. Components
 * never hard-code copy; they read the profile and nothing else.
 *
 * What the agency *does* is not written here twice: the hero, the services and the footer are the
 * active template's (`templates/index.ts`), so the public site sells the same specialism the
 * dashboard runs, and switching template changes both. Everything below that — your name, your
 * palette, your process and your prices — is a generic starting point the crew replaces.
 *
 * One rule that is not about taste: the proof strip carries facts about how the agency works and
 * **no number**, and there is no case study and no testimonial. A result is a factual claim about
 * someone else's business and a quote is words in a named person's mouth, so this template
 * carries neither — an unedited deploy must never publish client work nobody did.
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

export interface PricingTier {
  name: string;
  price: string;
  cadence: string;
  blurb: string;
  includes: string[];
  featured?: boolean;
}

/** The public site, as one record: `site_profile` in the store, the body of `GET /api/site`. */
export interface SiteProfile {
  company: string;
  tagline: string;
  /** One sentence of voice guidance for whoever (or whatever) rewrites the copy. */
  tone: string;
  /** The site's whole colour budget; everything else is ink on paper. */
  palette: { accent: string; accentInk: string; ground: string; ink: string; muted: string };
  hero: { eyebrow: string; title: string; subtitle: string; cta: string; secondaryCta: string };
  /** Facts about how the agency works — never a result, a count or a client name. */
  proof: { facts: string[] };
  services: Service[];
  whoWeServe: { title: string; subtitle: string; segments: { name: string; description: string }[] };
  process: { title: string; subtitle: string; steps: ProcessStep[] };
  pricing: { title: string; subtitle: string; tiers: PricingTier[] };
  faq: { title: string; items: { question: string; answer: string }[] };
  contact: { title: string; subtitle: string; email: string; offlineNote: string };
  footer: { note: string };
}

/** The section names an `update_site` may replace; anything else is refused by name. */
export const SITE_SECTIONS = [
  "company", "tagline", "tone", "palette", "hero", "proof", "services", "whoWeServe", "process", "pricing", "faq", "contact", "footer",
] as const satisfies readonly (keyof SiteProfile)[];

/**
 * A section is accepted when it has the seed's shape all the way down: the same type, every key
 * the seed has, and each list's items shaped like the seed's first — so a page never renders a
 * tier without a price or a step without a title. The store judges an `update_site` by it and the
 * page judges what `GET /api/site` served by it.
 */
export const sameShape = (seed: unknown, value: unknown): boolean => {
  if (Array.isArray(seed)) {
    return Array.isArray(value) && (seed.length === 0 || value.every((item) => sameShape(seed[0], item)));
  }
  if (typeof seed !== "object" || seed === null) return typeof value === typeof seed;
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const given = value as Record<string, unknown>;
  return Object.entries(seed).every(([key, inner]) => key in given && sameShape(inner, given[key]));
};

export const site: SiteProfile = {
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
  proof: {
    facts: [
      "Every deliverable passes your approval queue before it ships.",
      "One report a month, tied to the work — not to vanity metrics.",
      "Month to month after the first quarter; no long lock-in.",
    ],
  },
  services: ACTIVE.site.services,
  whoWeServe: {
    title: "Who we work with",
    subtitle: "Companies that want the work shown before it ships, and a number at the end of the month.",
    segments: [
      { name: "Founder-led companies", description: "You are the marketing team. We bring the calendar, you keep the last word." },
      { name: "Small marketing teams", description: "One or two people who need production capacity without losing control of the voice." },
      { name: "Multi-location businesses", description: "Several sites or markets that need one plan and one report." },
    ],
  },
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
  faq: {
    title: "Questions we get asked",
    items: [
      { question: "Who approves what goes out?", answer: "You do. Every draft, post and page waits in an approval queue until you release it; nothing is sent or published on your behalf." },
      { question: "How quickly does an engagement start?", answer: "The baseline begins the week the contract is signed and is written up within two weeks; the first calendar follows it." },
      { question: "What do you need from us?", answer: "Access to the accounts we report on, one person who can approve work, and an hour a week." },
      { question: "Can we stop?", answer: "Yes. Plans run month to month after the first quarter, and every deliverable is yours to keep." },
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
