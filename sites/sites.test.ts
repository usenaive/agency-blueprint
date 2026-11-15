import { mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BLOCK, PLACEHOLDER, fillSite, flatten } from "./fill.ts";

const ROOT = import.meta.dirname;
type Limit = { maxLength: number };
const vocabulary: {
  fields: Record<string, Limit>;
  lists: Record<string, { length: number; maxLength?: number; item?: Record<string, Limit> }>;
  optional: Record<string, { maxItems: number; maxLength?: number; item?: Record<string, Limit> }>;
} = JSON.parse(readFileSync(join(ROOT, "placeholders.json"), "utf8"));
const AGENCY_TYPES = ["recruiting", "security-testing", "market-research", "paid-ads", "seo-geo", "general"];
const ALLOWED_HOSTS = ["www.w3.org"]; // the SVG namespace, never fetched

/** Every key a values object must carry, with its length limit. */
const KEYS = new Map<string, number>(Object.entries(vocabulary.fields).map(([k, f]) => [k, f.maxLength]));
for (const [name, list] of Object.entries(vocabulary.lists)) {
  for (let i = 0; i < list.length; i++) {
    if (list.item) for (const [k, f] of Object.entries(list.item)) KEYS.set(`${name}[${i}].${k}`, f.maxLength);
    else KEYS.set(`${name}[${i}]`, list.maxLength!);
  }
}

/** Optional keys: never required in a values object, and only ever used inside an `{{#if}}` for themselves. */
const OPTIONAL = new Map<string, number>();
for (const [name, list] of Object.entries(vocabulary.optional)) {
  for (let i = 0; i < list.maxItems; i++) {
    if (list.item) for (const [k, f] of Object.entries(list.item)) OPTIONAL.set(`${name}[${i}].${k}`, f.maxLength);
    else OPTIONAL.set(`${name}[${i}]`, list.maxLength!);
  }
}

/** Placeholders left after removing every `{{#if}}` block: what an empty optional fill still shows. */
const unguarded = (html: string): string[] => {
  let out = html;
  for (let prev = ""; prev !== out;) { prev = out; out = out.replace(BLOCK, ""); }
  return placeholdersIn(out);
};

const files = (dir: string): string[] =>
  readdirSync(dir, { recursive: true, encoding: "utf8" }).filter((f) => statSync(join(dir, f)).isFile());
const placeholdersIn = (text: string): string[] => [...text.matchAll(PLACEHOLDER)].map((m) => m[1]!);

const sites = AGENCY_TYPES.flatMap((type) => {
  try { return readdirSync(join(ROOT, type)).map((name) => ({ type, name, dir: join(ROOT, type, name) })); }
  catch { return []; }
});

it.each(["recruiting", "security-testing", "market-research", "paid-ads"])("has the %s batch", (type) => {
  expect(sites.filter((s) => s.type === type)).toHaveLength(5);
});

describe.each(sites)("$type/$name", ({ type, name, dir }) => {
  const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
  const html = files(dir).filter((f) => f.endsWith(".html"));
  const text = files(dir).filter((f) => /\.(html|css|js|svg)$/.test(f));

  it("has a valid manifest", () => {
    expect(name).toMatch(/^\d-[a-z0-9-]+$/);
    expect(manifest).toMatchObject({ id: `${type}/${name}`, agencyType: type });
    expect(manifest.design).toEqual(expect.any(String));
    expect(manifest.style.length).toBeGreaterThan(10);
    expect(["light", "dark", "both"]).toContain(manifest.theme);
    for (const score of ["design", "usability", "creativity", "content", "overall"]) {
      expect(manifest.jury.critic[score]).toBeGreaterThanOrEqual(1);
    }
    expect(html).toEqual(expect.arrayContaining(["index.html", "404.html"]));
  });

  it("lists exactly the placeholders its HTML uses, all from the vocabulary", () => {
    const used = new Set(html.flatMap((f) => placeholdersIn(readFileSync(join(dir, f), "utf8"))));
    expect([...used].sort()).toEqual([...manifest.placeholders].sort());
    for (const key of used) expect(KEYS.has(key) || OPTIONAL.has(key), key).toBe(true);
    for (const f of html) for (const key of unguarded(readFileSync(join(dir, f), "utf8"))) expect(OPTIONAL.has(key), `${f}: ${key} outside {{#if}}`).toBe(false);
    for (const f of text.filter((f) => !f.endsWith(".html"))) expect(placeholdersIn(readFileSync(join(dir, f), "utf8")), f).toEqual([]);
  });

  it("has a complete sample within the vocabulary's limits", () => {
    const sample = flatten(JSON.parse(readFileSync(join(dir, "sample.json"), "utf8")));
    expect([...sample.keys()].filter((k) => !OPTIONAL.has(k)).sort()).toEqual([...KEYS.keys()].sort());
    for (const [key, value] of sample) expect(value.length, key).toBeLessThanOrEqual(KEYS.get(key) ?? OPTIONAL.get(key)!);
  });

  it.each([["with", "sample.json"], ["without", "bare.json"]])("fills %s optional proof, leaving no placeholder behind", (_, file) => {
    const sample = JSON.parse(readFileSync(join(dir, "sample.json"), "utf8"));
    for (const key of Object.keys(vocabulary.optional)) delete sample[key];
    const scratch = mkdtempSync(join(tmpdir(), "values-"));
    writeFileSync(join(scratch, "bare.json"), JSON.stringify(sample));
    const out = mkdtempSync(join(tmpdir(), "site-"));
    fillSite(dir, out, file === "bare.json" ? join(scratch, file) : undefined);
    for (const f of files(out).filter((f) => f.endsWith(".html"))) expect(readFileSync(join(out, f), "utf8"), f).not.toMatch(/\{\{|\}\}/);
    expect(files(out)).not.toContain("manifest.json");
  });

  it("leaves the host its head marker and never scrolls smoothly", () => {
    for (const f of html) expect(readFileSync(join(dir, f), "utf8"), f).toContain("<!--host-head-->");
    for (const f of text) expect(readFileSync(join(dir, f), "utf8"), f).not.toMatch(/scroll-behavior:\s*smooth|behavior:\s*["']smooth/);
  });

  it("requests nothing at runtime", () => {
    for (const f of text) {
      const hosts = [...readFileSync(join(dir, f), "utf8").matchAll(/(?:https?:)?\/\/([a-z0-9.-]+\.[a-z]{2,})/gi)].map((m) => m[1]!);
      for (const host of hosts) expect(ALLOWED_HOSTS, `${f}: ${host}`).toContain(host);
    }
  });
});

/** The platform fills these four from the company; `defaults.json` carries every other required key. */
const FROM_COMPANY = ["company_name", "city", "contact_email", "year"];
const defaults: Record<string, Record<string, unknown>> = JSON.parse(readFileSync(join(ROOT, "defaults.json"), "utf8"));

it.each(AGENCY_TYPES)("has defaults for %s: every required key but the company's, within limits, no proof", (type) => {
  const values = flatten(defaults[type]!);
  expect([...values.keys()].sort()).toEqual([...KEYS.keys()].filter((k) => !FROM_COMPANY.includes(k)).sort());
  for (const [key, value] of values) {
    expect(value.length, key).toBeLessThanOrEqual(KEYS.get(key)!);
    expect(value, key).not.toMatch(/[–—]/);
  }
});
