import "@fontsource-variable/inter";
import "./site.css";
import { lazy, StrictMode, Suspense, useEffect, useState, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import { TEMPLATE, type TemplateName } from "../../templates/index.ts";
import { operatorRedirect } from "../routing.ts";
import type { SiteProfile } from "../site.config.ts";
import { App } from "./App.tsx";
import { loadBlog, loadSite, type PublicPost } from "./profile.ts";
import { applyGoogleAnalytics, applySeo } from "./seo.ts";

type Theme = ComponentType<{ site: SiteProfile; blog?: PublicPost[] }>;

/**
 * A template may carry its own public site (`themes/<name>/`), loaded only when that template runs;
 * a template with none renders the default `App`. Every theme reads the same profile.
 */
const THEMES: Partial<Record<TemplateName, () => Promise<{ default: Theme }>>> = {
  "seo-geo": () => import("./themes/search/SearchSite.tsx"),
  security: () => import("./themes/security/SecuritySite.tsx"),
  "market-research": () => import("./themes/research/ResearchSite.tsx"),
  advertising: () => import("./themes/studio/StudioSite.tsx"),
};
const chosen = THEMES[TEMPLATE]?.(); // fetched beside /api/site, not after it
const ThemeSite = chosen ? lazy(() => chosen) : null;

// A pre-`/app` operator bookmark lands on the public site on a static deploy; send it on before paint.
const legacy = operatorRedirect(location.pathname);
if (legacy !== null) location.replace(`${legacy}${location.search}`);

// The palette is profile, not CSS: recolouring the whole site is an `update_site`. Applied before
// the page renders so nothing flashes.
function paint(site: SiteProfile) {
  const { palette } = site;
  for (const [key, value] of Object.entries({
    "--accent": palette.accent,
    "--accent-ink": palette.accentInk,
    "--ground": palette.ground,
    "--ink": palette.ink,
    "--muted": palette.muted,
  })) {
    document.documentElement.style.setProperty(key, value);
  }
  applySeo(site);
  applyGoogleAnalytics(site.analytics.googleMeasurementId);
}

function Site() {
  const [site, setSite] = useState<SiteProfile | null>(null);
  const [blog, setBlog] = useState<PublicPost[]>([]);
  useEffect(() => {
    void Promise.all([loadSite(), loadBlog()]).then(([profile, posts]) => {
      paint(profile);
      setSite(profile);
      setBlog(posts);
    });
  }, []);
  if (site === null) return null;
  if (ThemeSite === null) return <App site={site} blog={blog} />;
  return (
    <Suspense fallback={null}>
      <ThemeSite site={site} blog={blog} />
    </Suspense>
  );
}

if (legacy === null) {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <Site />
    </StrictMode>,
  );
}
