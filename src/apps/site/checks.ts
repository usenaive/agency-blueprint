/**
 * What the SEO & GEO screen checks on the agency's own public site, computed from the same profile
 * and articles the server renders the page from (`server/public-site.ts`), so a pass here is a pass
 * in the served HTML. Pure, so the thresholds are tested rather than eyeballed.
 */
import type { SiteProfile } from "../../../site/site.config";

export interface SiteCheck { label: string; done: boolean; detail: string }

/** The lengths search results show without cutting; outside them the snippet is truncated or thin. */
const TITLE = { min: 30, max: 65 };
const DESCRIPTION = { min: 70, max: 160 };

export function siteChecks(site: SiteProfile, holdingCompany: string, publishedArticles: number): SiteCheck[] {
  const title = `${site.company} — ${site.tagline}`;
  const description = site.hero.subtitle;
  return [
    {
      label: "Your profile is live, not the holding page",
      done: site.company !== holdingCompany,
      detail: site.company !== holdingCompany ? site.company : "Crawlers see the placeholder until the profile names a real company and inbox.",
    },
    {
      label: "Title fits a search result",
      done: title.length >= TITLE.min && title.length <= TITLE.max,
      detail: `${title.length} characters (${TITLE.min}–${TITLE.max}): “${title}”`,
    },
    {
      label: "Description fits a search result",
      done: description.length >= DESCRIPTION.min && description.length <= DESCRIPTION.max,
      detail: `${description.length} characters (${DESCRIPTION.min}–${DESCRIPTION.max}); it is the hero subtitle.`,
    },
    {
      label: "Services named in structured data",
      done: site.services.length > 0,
      detail: `${site.services.length} services sent as what the agency knows about.`,
    },
    {
      label: "Answers AI assistants can quote",
      done: site.faq.items.length >= 3,
      detail: `${site.faq.items.length} FAQ answers in structured data; three or more give an assistant something to cite.`,
    },
    {
      label: "Published articles",
      done: publishedArticles > 0,
      detail: `${publishedArticles} live, each in the sitemap and llms.txt.`,
    },
  ];
}
