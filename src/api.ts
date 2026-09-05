/**
 * The screens' only door to the dashboard server (`server/routes.ts`).
 *
 * It does not hide failure (ADR-0374). The previous version answered a caller-supplied fallback on
 * any non-JSON response, and the fallbacks passed in were the seed rows compiled into this bundle,
 * so a dashboard whose `/api/*` routes were entirely absent presented fabricated rows as the
 * operator's real data. Now a failed call throws, the screen says what happened, and an empty
 * screen means an empty store — which is the truth about a new deployment.
 */
import { useEffect, useState } from "react";

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

/** Said when the request never reached a server, or reached something that is not this one. */
const UNREACHABLE = "the dashboard server is unreachable";

/**
 * The operator's access token for `/api/*` — the app's `DASHBOARD_TOKEN`.
 *
 * Kept in `sessionStorage`: it lives as long as the tab, never lands in a URL, a bookmark or a
 * server log, and closing the tab ends the session. It is asked for on the first 401 rather than at
 * boot, so a local `pnpm serve` with no token set never sees a prompt and the deployment asks
 * exactly once. A 401 clears it and asks again, so a rotated token is one answer, not a dead tab.
 */
const TOKEN_KEY = "dashboard-token";

/** Every access is guarded: a private window, or no DOM at all under the unit tests. */
const readToken = (): string | null => {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

const writeToken = (token: string | null): void => {
  try {
    if (token === null) sessionStorage.removeItem(TOKEN_KEY);
    else sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Nothing is kept; the next 401 asks again.
  }
};

/** Plain on purpose — this is an operator tool, and a login screen would be a lie about it. */
const askForToken = (): string | null => {
  const ask = (globalThis as { prompt?: (message: string) => string | null }).prompt;
  const asked = ask?.("Dashboard access token")?.trim();
  if (!asked) return null;
  writeToken(asked);
  return asked;
};

async function call<T>(path: string, init: RequestInit, retry = true): Promise<T> {
  const sent = readToken();
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      headers: {
        ...(init.headers as Record<string, string> | undefined),
        ...(sent === null ? {} : { authorization: `Bearer ${sent}` }),
      },
    });
  } catch {
    throw new ApiError(0, UNREACHABLE);
  }
  if (res.status === 401) {
    // Screens load in parallel, so several calls can 401 at once. If one of them has already been
    // given a fresh token, use it instead of clearing that answer and asking a second time.
    const stored = readToken();
    let fresh = stored !== null && stored !== sent ? stored : null;
    if (fresh === null) {
      writeToken(null);
      fresh = askForToken();
    }
    if (retry && fresh !== null) return call<T>(path, init, false);
    throw new ApiError(401, "an access token is required");
  }
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(await res.text());
  } catch {
    // A 404 served as the SPA's index.html lands here: not JSON, so not this server's answer.
  }
  if (!res.ok) throw new ApiError(res.status, (parsed as { error?: string } | null)?.error ?? UNREACHABLE);
  if (parsed === null) throw new ApiError(res.status, UNREACHABLE);
  return parsed as T;
}

export const apiGet = <T>(path: string): Promise<T> => call<T>(path, { headers: { accept: "application/json" } });

export const apiSend = <T>(method: string, path: string, body?: unknown): Promise<T> =>
  call<T>(path, {
    method,
    headers: { accept: "application/json", ...(body === undefined ? {} : { "content-type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

/** The sentence a screen shows for a failed call, whatever was thrown. */
export const apiMessage = (error: unknown): string => (error instanceof ApiError ? error.message : UNREACHABLE);

/**
 * One GET, held the way every screen holds it: `null` while it is in flight (the screen shows its
 * skeleton), a sentence when it failed (the screen shows that), an array when it worked — empty
 * included, which renders the screen's empty state.
 */
export function useApi<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void apiGet<T>(path)
      .then((rows) => { if (live) setData(rows); })
      .catch((err: unknown) => { if (live) setError(apiMessage(err)); });
    return () => { live = false; };
  }, [path]);
  return { data, error, setData, setError };
}
