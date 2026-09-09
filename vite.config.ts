import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { isOperatorPath, operatorRedirect } from "./site/routing.ts";

/**
 * The dev server's half of `site/routing.ts`: a deep link under `/app` is the operator bundle's
 * page (`appType: "mpa"` alone would 404 it), and a pre-`/app` operator path is redirected.
 * `pnpm serve` and the deployed rewrites do the same for the built tree.
 */
const twoDoors = (): Plugin => ({
  name: "agency:two-doors",
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
      const legacy = operatorRedirect(pathname);
      if (legacy !== null) return void res.writeHead(302, { location: legacy }).end();
      if (isOperatorPath(pathname) && !/\.\w+$/.test(pathname)) req.url = "/app/index.html";
      next();
    });
  },
});

const entry = (file: string) => fileURLToPath(new URL(file, import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss(), twoDoors()],
  /**
   * One build, two pages: `index.html` is the public site, served at `/`; `app/index.html` is the
   * operator dashboard, served for `/app` and everything under it. Same origin, so the site's
   * `GET /api/site` and its contact form's `POST /api/leads` need no second host.
   */
  appType: "mpa",
  build: { rollupOptions: { input: { site: entry("index.html"), app: entry("app/index.html") } } },
  /**
   * *** THE ONE WAY THE BROWSER LEARNS WHICH TEMPLATE THIS BUILD IS. ***
   *
   * `templates/index.ts` picks `TEMPLATE` from `process.env["NAIVE_TEMPLATE"]`, and that module is
   * imported by the screens as well as by `naive.config.ts`. In Node the read works. In a client
   * bundle it does not: Vite compiles a bare `process.env` to `{}`, so the screens read `undefined`
   * and every build fell back to this repository's default template — measured, the published
   * `blank` and `seo-geo` dashboards were byte-identical, and an operator installing `blank` got
   * the `seo-geo` UI.
   *
   * A `define` is the fix because the template is a BUILD-TIME fact, not a runtime one: one build
   * is one template, the deployed dashboard is static files, and there is no request in which the
   * value could still be chosen. So it is substituted here, where it is known.
   *
   * The public site reads the template's own copy through the same module, and `build-api.mjs`
   * carries the same line for the server half.
   *
   * Unset — every run that is not the platform's artifact publisher — this substitutes `""`, which
   * is falsy, and `templates/index.ts` keeps the default the file itself names. Nothing changes for
   * an operator who switches template by editing that line.
   */
  define: { "process.env.NAIVE_TEMPLATE": JSON.stringify(process.env["NAIVE_TEMPLATE"] ?? "") },
  /**
   * `pnpm dev` keeps its demo without compiling a single seed row into the bundle: the screens
   * read the seeded **file** store through the real routes of a local `pnpm serve` on :8789. With
   * no server running, every screen shows its empty state or the unreachable error — which is
   * exactly what the deployment does, and the point of seeing it here first.
   */
  server: { proxy: { "/api": "http://localhost:8789", "/mcp": "http://localhost:8789" } },
});
