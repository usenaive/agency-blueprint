import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The public site is its own small app rooted here; it builds to `site/dist`
// (the second §29 app in naive.config.ts). In dev, `/api` proxies to the
// dashboard server so the contact form lands leads in the CRM store.
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react(), tailwindcss()],
  // The template, substituted at build time. `site/site.config.ts` reads `ACTIVE` out of
  // `templates/index.ts`, which chooses on `process.env["NAIVE_TEMPLATE"]` — and Vite compiles a
  // bare `process.env` to `{}` in a client bundle, so without this the site shipped this
  // repository's default specialism whichever template it was built for. See the long note in
  // `../vite.config.ts`; unset it is `""`, and the default the file names stands.
  define: { "process.env.NAIVE_TEMPLATE": JSON.stringify(process.env["NAIVE_TEMPLATE"] ?? "") },
  build: { outDir: "dist", emptyOutDir: true },
  server: { proxy: { "/api": "http://localhost:8789" } },
});
