import "@fontsource-variable/inter";
import "./site.css";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { operatorRedirect } from "../routing.ts";
import type { SiteProfile } from "../site.config.ts";
import { App } from "./App.tsx";
import { loadSite } from "./profile.ts";

// A pre-`/app` operator bookmark lands on the public site on a static deploy; send it on before paint.
const legacy = operatorRedirect(location.pathname);
if (legacy !== null) location.replace(`${legacy}${location.search}`);

// The palette is profile, not CSS: recolouring the whole site is an `update_site`. Applied before
// the page renders so nothing flashes.
function paint({ palette, company, tagline }: SiteProfile) {
  for (const [key, value] of Object.entries({
    "--accent": palette.accent,
    "--accent-ink": palette.accentInk,
    "--ground": palette.ground,
    "--ink": palette.ink,
    "--muted": palette.muted,
  })) {
    document.documentElement.style.setProperty(key, value);
  }
  document.title = `${company} — ${tagline}`;
}

function Site() {
  const [site, setSite] = useState<SiteProfile | null>(null);
  useEffect(() => {
    void loadSite().then((profile) => {
      paint(profile);
      setSite(profile);
    });
  }, []);
  return site === null ? null : <App site={site} />;
}

if (legacy === null) {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <Site />
    </StrictMode>,
  );
}
