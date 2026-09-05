import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  /**
   * `pnpm dev` keeps its demo without compiling a single seed row into the bundle: the screens
   * read the seeded **file** store through the real routes of a local `pnpm serve` on :8789. With
   * no server running, every screen shows its empty state or the unreachable error — which is
   * exactly what the deployment does, and the point of seeing it here first.
   */
  server: { proxy: { "/api": "http://localhost:8789", "/mcp": "http://localhost:8789" } },
});
