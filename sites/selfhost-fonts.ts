/**
 * Replace a site's Google Fonts <link> with self-hosted woff2 files, so the page makes no
 * runtime request at all. Writes assets/fonts/*.woff2, assets/fonts.css and a licence note, and
 * rewrites the <link> in every .html file (a 404.html gets the root-absolute path).
 *
 *   node --experimental-strip-types sites/selfhost-fonts.ts sites/recruiting/1-brief
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const LINK = /<link[^>]+href="(https:\/\/fonts\.googleapis\.com\/css2\?[^"]+)"[^>]*>/;
const PRECONNECT = /\s*<link[^>]+rel="preconnect"[^>]+fonts\.(?:googleapis|gstatic)\.com[^>]*>/g;

const site = process.argv[2];
if (!site) throw new Error("usage: selfhost-fonts.ts <siteDir>");
const pages = readdirSync(site).filter((f) => f.endsWith(".html"));
const url = pages.map((f) => LINK.exec(readFileSync(join(site, f), "utf8"))?.[1]).find(Boolean);
if (!url) throw new Error(`${site}: no Google Fonts link`);

const css = await (await fetch(url.replace(/&amp;/g, "&"), { headers: { "user-agent": UA } })).text();
// Latin only: each block is preceded by its subset comment.
const blocks = [...css.matchAll(/\/\* ([a-z-]+) \*\/\s*(@font-face\s*\{[^}]+\})/g)].filter((m) => m[1] === "latin").map((m) => m[2]!);
mkdirSync(join(site, "assets/fonts"), { recursive: true });
const families = new Set<string>();
const saved = new Map<string, string>(); // a variable font serves every weight from one file
const out: string[] = [];
for (const block of blocks) {
  const family = /font-family: '([^']+)'/.exec(block)![1]!;
  const style = /font-style: (\w+)/.exec(block)![1]!;
  const weight = /font-weight: ([\d ]+)/.exec(block)![1]!.replace(" ", "-");
  const src = /url\((https:[^)]+\.woff2)\)/.exec(block)![1]!;
  const file = saved.get(src) ?? `${family.toLowerCase().replace(/ /g, "-")}-${style}-${weight}.woff2`;
  if (!saved.has(src)) writeFileSync(join(site, "assets/fonts", file), Buffer.from(await (await fetch(src)).arrayBuffer()));
  saved.set(src, file);
  out.push(block.replace(/src: url\([^)]+\) format\('woff2'\)/, `src: url(fonts/${file}) format("woff2")`));
  families.add(family);
}
writeFileSync(join(site, "assets/fonts.css"), `${out.join("\n")}\n`);
writeFileSync(join(site, "assets/fonts/LICENSE.txt"),
  `${[...families].join(", ")}: from Google Fonts, licensed under the SIL Open Font License 1.1 (openfontlicense.org).\n`);
for (const f of pages) {
  const path = join(site, f);
  const href = f === "404.html" ? "/assets/fonts.css" : "assets/fonts.css";
  writeFileSync(path, readFileSync(path, "utf8").replace(PRECONNECT, "").replace(LINK, `<link rel="stylesheet" href="${href}">`));
}
console.log(`${site}: ${out.length} faces, ${[...families].join(", ")}`);
