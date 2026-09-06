/**
 * Emits the deployed dashboard's server half into `dist/`, which is what `deploy_dir` ships.
 *
 * One function, not one per route (ADR-0374): the host's zero-config file map turns
 * `dist/api/app.js` into `/api/app`, and the rewrites below point `/mcp` and every `/api/*` path
 * at it with the original path stated in `__path`. Twelve entry files would each re-bundle the
 * store, each hold a connection, and each drift on their own; one means a single warm instance for
 * the browser and the agents both. `app` is therefore a reserved route name.
 *
 * Without this the app deploys as static files only: `/mcp` 404s, the `mcp: "/mcp"` declaration in
 * `naive.config.ts` points at nothing, and every screen's `/api/*` call answers HTML. The host
 * builds `dist/api/*` into functions and installs `dist/package.json`, so those three files are
 * the whole server contract.
 */
import { build } from "esbuild";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, "dist");

mkdirSync(join(dist, "api"), { recursive: true });
// The one-function-per-route predecessor, in case `api:build` runs without the `vite build` that
// empties `dist/`: a second entry would ship as a second function over a second connection.
rmSync(join(dist, "api", "mcp.js"), { force: true });

await build({
  entryPoints: [join(root, "server", "api-entry.ts")],
  outfile: join(dist, "api", "app.js"),
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  // Installed from the manifest below rather than inlined: `pg` ships native-ish internals that do
  // not survive bundling, and the host installs it anyway.
  external: ["pg"],
  // The template, substituted here for the reason `vite.config.ts` substitutes it for the screens:
  // one build is one template. The server half imports `templates/active.ts` for the crew, the
  // deliverable kinds and the seed, and on the deployed host `NAIVE_TEMPLATE` is not in the
  // environment — so a runtime read there answers with this repository's default template while the
  // screens beside it show the built one. Substituted, the two halves of one deployment cannot
  // disagree. Unset it is `""`, falsy, and `templates/index.ts` keeps the default it names.
  define: { "process.env.NAIVE_TEMPLATE": JSON.stringify(process.env["NAIVE_TEMPLATE"] ?? "") },
});

// Three rewrites, in this order. `/mcp` is the endpoint `naive.config.ts` declares; `/api/(.*)`
// carries every dashboard route to the same function with its own path intact; the last is the
// single-page fallback, without which a reload, a bookmark or a shared deep link into any screen
// is a hard 404 from the host. The host checks the filesystem before it rewrites, so `/api/app`
// and every static asset are served directly and the fallback never swallows a function.
writeFileSync(
  join(dist, "vercel.json"),
  `${JSON.stringify(
    {
      rewrites: [
        { source: "/mcp", destination: "/api/app?__path=/mcp" },
        { source: "/api/(.*)", destination: "/api/app?__path=/api/$1" },
        { source: "/((?!api/).*)", destination: "/index.html" },
      ],
    },
    null,
    2,
  )}\n`,
);

writeFileSync(
  join(dist, "package.json"),
  `${JSON.stringify(
    { name: "agency-dashboard", private: true, type: "module", dependencies: { pg: "^8.16.3" } },
    null,
    2,
  )}\n`,
);

process.stdout.write("dist/api/app.js, dist/vercel.json, dist/package.json\n");
