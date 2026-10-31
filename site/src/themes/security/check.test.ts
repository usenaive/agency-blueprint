import { describe, expect, it } from "vitest";
import { readHeaders } from "./check.ts";

const status = (lines: ReturnType<typeof readHeaders>) => Object.fromEntries(lines.map((l) => [l.name, [l.status, l.detail]]));

describe("the page's own passive check", () => {
  it("reports what is set, and says what an absent header would protect", () => {
    const lines = status(readHeaders(new Headers({
      "strict-transport-security": "max-age=63072000",
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin",
    }), true));
    expect(lines["HTTPS"]).toEqual(["pass", "encrypted connection"]);
    expect(lines["HSTS"]).toEqual(["pass", "max-age 24 months"]);
    expect(lines["X-Content-Type-Options"]).toEqual(["pass", "nosniff"]);
    expect(lines["Referrer-Policy"]).toEqual(["pass", "strict-origin-when-cross-origin"]);
    expect(lines["Permissions-Policy"]).toEqual(["missing", "turns off camera, mic, location"]);
    expect(lines["Content-Security-Policy"]).toEqual(["missing", "limits which scripts may run"]);
    expect(lines["Framing protection"]).toEqual(["missing", "stops other sites framing the page"]);
  });

  it("never passes HTTPS or HSTS on a plain-http preview", () => {
    const lines = status(readHeaders(new Headers({ "strict-transport-security": "max-age=63072000" }), false));
    expect(lines["HTTPS"]?.[0]).toBe("note");
    expect(lines["HSTS"]?.[0]).toBe("note");
  });

  it("fails a short HSTS max-age, a wrong nosniff value, and credits frame-ancestors as framing protection", () => {
    const lines = status(readHeaders(new Headers({
      "strict-transport-security": "max-age=3600",
      "x-content-type-options": "sniff",
      "content-security-policy": "default-src 'self'; frame-ancestors 'none'",
    }), true));
    expect(lines["HSTS"]?.[0]).toBe("missing");
    expect(lines["X-Content-Type-Options"]?.[0]).toBe("missing");
    expect(lines["Content-Security-Policy"]).toEqual(["pass", "set"]);
    expect(lines["Framing protection"]).toEqual(["pass", "frame-ancestors"]);
  });
});
