/**
 * *** THE TEMPLATE HAS TO REACH THE BUNDLE, AND FOR A LONG TIME IT DID NOT. ***
 *
 * `templates/index.ts` picks `TEMPLATE` from `process.env["NAIVE_TEMPLATE"]`, and that module is
 * the screens' and the public site's as much as the config's. In Node the read works, which is why
 * `naive.config.ts` reported the right template and the catalog row said `blank`. In a client
 * bundle it does not: Vite compiles a bare `process.env` to `{}`, so the screens read `undefined`
 * and fell back to this repository's default. Measured on the published catalog, `blank@0.1.0` and
 * `seo-geo@0.1.0` shipped the SAME dashboard digest and the SAME site digest — two rows, one pair
 * of trees, and an operator installing `blank` got Meridian Search's search agency instead.
 *
 * A unit test on `ACTIVE` cannot see this: it runs in Node, where the read has always worked. Only
 * the emitted bytes can, so this builds them — both apps this blueprint ships, since each has its
 * own Vite config and each has to carry the same substitution.
 */
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { build, type Rollup } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));
const original = process.env["NAIVE_TEMPLATE"];

/** One app, compiled for one template. Never written: `dist` is what `pnpm build` owns. */
async function bundle(config: string, template: string): Promise<string> {
  process.env["NAIVE_TEMPLATE"] = template;
  const result = (await build({
    configFile: `${root}${config}`,
    logLevel: "silent",
    build: { write: false },
  })) as Rollup.RollupOutput;
  return result.output
    .filter((chunk): chunk is Rollup.OutputChunk => chunk.type === "chunk")
    .map((chunk) => chunk.code)
    .join("\n");
}

/** Compared as digests, not as text: two 200 kB bundles printed side by side say nothing. */
const digest = (code: string) => createHash("sha256").update(code).digest("hex");

afterAll(() => {
  if (original === undefined) delete process.env["NAIVE_TEMPLATE"];
  else process.env["NAIVE_TEMPLATE"] = original;
});

describe.each([
  ["dashboard", "vite.config.ts"],
  ["site", "site/vite.config.ts"],
])("the built %s", (_app, config) => {
  let blank = "";
  let seoGeo = "";

  beforeAll(async () => {
    blank = await bundle(config, "blank");
    seoGeo = await bundle(config, "seo-geo");
  }, 180_000);

  it("is a different bundle for each template", () => {
    // The whole bug in one line. Before the `define` in the Vite configs these two bundles were
    // byte-identical, and so were the two catalog rows built from them.
    expect(digest(blank)).not.toEqual(digest(seoGeo));
  });

  it("carries the choice as a literal, not as a read the browser cannot make", () => {
    // `{}.NAIVE_TEMPLATE` is what the broken build shipped: the name survives into the bundle
    // precisely because nothing substituted it. Substituted, the name is gone and the value is in.
    expect(blank).not.toContain("NAIVE_TEMPLATE");
    expect(seoGeo).not.toContain("NAIVE_TEMPLATE");
  });
});
