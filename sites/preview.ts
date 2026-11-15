/**
 * Fill a site with its sample.json and screenshot it with headless Chrome over the DevTools
 * protocol (a flag-only `--screenshot` cannot go below a 500 px window): preview-desktop.png
 * (1440x900) and preview-phone.png (390x844, mobile), into the site's folder.
 *
 *   node --experimental-strip-types sites/preview.ts sites/recruiting/1-brief [--full] [--dark]
 *
 * `--full` also writes full-page shots to the temp dir for review; `--dark` emulates a dark scheme.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fillSite } from "./fill.ts";

const CHROME = process.env["CHROME"] ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const [siteArg, ...flags] = process.argv.slice(2);
if (!siteArg) throw new Error("usage: preview.ts <siteDir> [--full] [--dark]");
const site = resolve(siteArg);
const out = mkdtempSync(join(tmpdir(), "site-preview-"));
fillSite(site, out);

const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=0", "--hide-scrollbars", `--user-data-dir=${join(out, ".chrome")}`, "about:blank"]);
const browserUrl: string = await new Promise((ok) => chrome.stderr.on("data", (d: Buffer) => {
  const m = /DevTools listening on (ws:\/\/\S+)/.exec(d.toString());
  if (m) ok(m[1]!);
}));
const port = new URL(browserUrl).port;
const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json() as { webSocketDebuggerUrl: string };
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((ok) => ws.addEventListener("open", ok));
let id = 0;
const pending = new Map<number, (r: any) => void>();
let loaded = (): void => {};
ws.addEventListener("message", (e) => {
  const msg = JSON.parse(String(e.data));
  if (msg.method === "Page.loadEventFired") loaded();
  pending.get(msg.id)?.(msg.result);
});
const send = (method: string, params = {}): Promise<any> =>
  new Promise((ok) => { pending.set(++id, ok); ws.send(JSON.stringify({ id, method, params })); });

const scheme = flags.includes("--dark") ? "dark" : "light";
await send("Page.enable");
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: scheme }] });
for (const [name, width, height, mobile] of [["desktop", 1440, 900, false], ["phone", 390, 844, true]] as const) {
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
  const load = new Promise<void>((ok) => { loaded = ok; });
  await send("Page.navigate", { url: `file://${out}/index.html` });
  await load;
  // Fonts, then time for the intro to settle: the preview is the page at rest.
  await send("Runtime.evaluate", { expression: "document.fonts.ready.then(() => new Promise(r => setTimeout(r, 2500)))", awaitPromise: true });
  const shot = await send("Page.captureScreenshot", { format: "png" });
  const suffix = scheme === "dark" ? "-dark" : "";
  writeFileSync(join(site, `preview-${name}${suffix}.png`), Buffer.from(shot.data, "base64"));
  if (flags.includes("--full")) {
    const full = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
    writeFileSync(join(out, `full-${name}${suffix}.png`), Buffer.from(full.data, "base64"));
  }
}
ws.close();
chrome.kill();
console.log(out);
