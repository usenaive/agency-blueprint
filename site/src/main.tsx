import "@fontsource-variable/inter";
import "./site.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { site } from "../site.config.ts";
import { App } from "./App.tsx";

// The palette is config, not CSS: recolouring the whole site is a
// site.config.ts edit. Applied before first paint so nothing flashes.
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
document.title = `${site.company} — ${site.tagline}`;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
