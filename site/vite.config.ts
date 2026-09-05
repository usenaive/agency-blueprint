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
  build: { outDir: "dist", emptyOutDir: true },
  server: { proxy: { "/api": "http://localhost:8789" } },
});
