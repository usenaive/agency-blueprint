/**
 * The page's copy comes from `GET /api/site` — the `site_profile` the crew edits and the operator
 * approves — so a visitor sees what was approved, not what was compiled. The route is public and
 * same-origin, so this is one fetch with no bearer. When it cannot be read (local preview with no
 * server, a host mid-deploy) the compiled seed stands in: the page never renders blank.
 */
import { site as seed, type SiteProfile } from "../site.config.ts";

export async function loadSite(doFetch: typeof fetch = fetch): Promise<SiteProfile> {
  try {
    const res = await doFetch("/api/site", { headers: { accept: "application/json" } });
    if (!res.ok || !(res.headers.get("content-type")?.includes("application/json") ?? false)) return seed;
    return (await res.json()) as SiteProfile;
  } catch {
    return seed;
  }
}
