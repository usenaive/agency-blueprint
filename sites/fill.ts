/**
 * Fill a pre-made agency site: plain string replacement of `{{key}}` placeholders, no model.
 * Keys follow `sites/placeholders.json`: `company_name`, `services[0].title`, `specialties[2]`.
 * Values are HTML-escaped, and only `.html` files carry placeholders. Optional content sits in
 * `{{#if key}}…{{/if}}` blocks (`proof`, `proof[1]`, `logos[0]`), kept when the key has a
 * non-empty value and removed otherwise; blocks may nest.
 *
 *   node --experimental-strip-types sites/fill.ts <siteDir> <outDir> [values.json]
 *
 * With no values file it fills from the site's own `sample.json`.
 */
import { cpSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const PLACEHOLDER = /\{\{([a-z_]+(?:\[\d+\])?(?:\.[a-z_]+)?)\}\}/g;

/** `{ services: [{ title }] }` → `{ "services[0].title": … }`. */
export function flatten(values: Record<string, unknown>): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (key: string, value: unknown): void => {
    if (Array.isArray(value)) value.forEach((item, i) => walk(`${key}[${i}]`, item));
    else if (value !== null && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) walk(`${key}.${k}`, v);
    } else out.set(key, String(value));
  };
  for (const [k, v] of Object.entries(values)) walk(k, v);
  return out;
}

const escape = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export const BLOCK = /\{\{#if ([a-z_]+(?:\[\d+\])?(?:\.[a-z_]+)?)\}\}((?:(?!\{\{#if )[\s\S])*?)\{\{\/if\}\}/g;

const present = (key: string, values: Map<string, string>): boolean =>
  [...values].some(([k, v]) => (k === key || k.startsWith(`${key}[`) || k.startsWith(`${key}.`)) && v.trim() !== "");

/** Resolve `{{#if}}` blocks innermost first, then replace every known placeholder; unknown ones stay for the caller to catch. */
export function fill(html: string, values: Map<string, string>): string {
  let out = html;
  for (let prev = ""; prev !== out;) {
    prev = out;
    out = out.replace(BLOCK, (_, key: string, body: string) => (present(key, values) ? body : ""));
  }
  return out.replace(PLACEHOLDER, (whole, key: string) => (values.has(key) ? escape(values.get(key)!) : whole));
}

/** Files that describe a site but are not served. */
export const NOT_SERVED = /^(manifest\.json|sample\.json|preview-.*\.png)$/;

export function fillSite(siteDir: string, outDir: string, valuesFile = join(siteDir, "sample.json")): void {
  const values = flatten(JSON.parse(readFileSync(valuesFile, "utf8")));
  cpSync(siteDir, outDir, { recursive: true, filter: (src) => !NOT_SERVED.test(src.split("/").pop()!) });
  for (const entry of readdirSync(outDir, { recursive: true, encoding: "utf8" })) {
    if (!entry.endsWith(".html")) continue;
    const path = join(outDir, entry);
    writeFileSync(path, fill(readFileSync(path, "utf8"), values));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [siteDir, outDir, valuesFile] = process.argv.slice(2);
  if (!siteDir || !outDir) throw new Error("usage: fill.ts <siteDir> <outDir> [values.json]");
  fillSite(siteDir, outDir, valuesFile);
}
