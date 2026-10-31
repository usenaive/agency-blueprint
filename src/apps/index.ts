/**
 * Each primitive app's screen (ADR-1766). The deployment's `APP_ID` picks one, and the Studio draws
 * everything around it — the rail, Home, approvals, agents and each app's chat — so an app is one
 * screen and the pages it links to, with no shell of its own.
 */
import type { ComponentType } from "react";
import type { AppId } from "../../templates";
import { Ads } from "./ads/Ads";
import { Calendar } from "./calendar/Calendar";
import { Crm } from "./crm/Crm";
import { Seo } from "./seo/Seo";
import { Site } from "./site/Site";

export const SCREENS: Record<AppId, { label: string; Component: ComponentType }> = {
  crm: { label: "CRM", Component: Crm },
  "landing-page": { label: "Landing page", Component: Site },
  "seo-geo": { label: "SEO & GEO", Component: Seo },
  ads: { label: "Ads", Component: Ads },
  calendar: { label: "Calendar", Component: Calendar },
};
