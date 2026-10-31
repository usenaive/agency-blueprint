/**
 * The passive check the security theme runs on its own page (DESIGN.md): one same-origin GET
 * of this URL, read for the headers a browser received. Read-only, nothing leaves this
 * origin, and every line reports what is actually there, including "not set".
 */
export type Status = "pass" | "missing" | "note";

export interface CheckLine {
  name: string;
  status: Status;
  detail: string;
}

const MONTH = 30 * 24 * 3600;

/** What each header protects, said when it is absent, so a missing line explains itself. */
const WHY: Record<string, string> = {
  HSTS: "keeps return visits on https",
  "X-Content-Type-Options": "stops files being run as another type",
  "Referrer-Policy": "keeps full URLs from other sites",
  "Permissions-Policy": "turns off camera, mic, location",
  "Content-Security-Policy": "limits which scripts may run",
  "Framing protection": "stops other sites framing the page",
};

export function readHeaders(headers: Headers, https: boolean): CheckLine[] {
  const get = (name: string) => headers.get(name)?.trim() ?? "";
  const hsts = get("strict-transport-security");
  const age = Number(/max-age=(\d+)/i.exec(hsts)?.[1] ?? 0);
  const csp = get("content-security-policy");
  const frames = get("x-frame-options") || (/frame-ancestors/i.test(csp) ? "frame-ancestors" : "");
  const set = (name: string, value: string, ok = value !== ""): CheckLine =>
    ({ name, status: ok ? "pass" : "missing", detail: ok ? value : WHY[name]! });
  return [
    https ? { name: "HTTPS", status: "pass", detail: "encrypted connection" } : { name: "HTTPS", status: "note", detail: "local preview over http" },
    !https ? { name: "HSTS", status: "note", detail: "only sent over https" }
      : hsts ? { name: "HSTS", status: age >= 6 * MONTH ? "pass" : "missing", detail: `max-age ${Math.round(age / MONTH)} months` }
      : { name: "HSTS", status: "missing", detail: WHY.HSTS! },
    set("X-Content-Type-Options", get("x-content-type-options"), get("x-content-type-options").toLowerCase() === "nosniff"),
    set("Referrer-Policy", get("referrer-policy")),
    set("Permissions-Policy", get("permissions-policy") ? "restricted" : ""),
    set("Content-Security-Policy", csp ? "set" : ""),
    set("Framing protection", frames),
  ];
}

export async function checkThisPage(): Promise<CheckLine[] | null> {
  try {
    // This page's own URL, absolute: a bare pathname such as `//host/x` is protocol-relative and would
    // send the request to another host.
    const self = new URL(location.href);
    self.hash = "";
    const res = await fetch(self.href, { cache: "no-store", credentials: "same-origin" });
    return readHeaders(res.headers, location.protocol === "https:");
  } catch {
    return null;
  }
}
