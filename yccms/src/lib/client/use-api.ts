"use client";

import { useCallback, useEffect, useState } from "react";

export class ApiClientError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

async function parse<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (res.status === 401) {
    // Session expired: full reload so the proxy re-runs the login gate.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
  }
  if (!res.ok) throw new ApiClientError(res.status, body.error ?? `Lỗi ${res.status}`, body.details);
  return body as T;
}

export async function apiSend<T = { ok: boolean }>(method: "POST" | "PATCH", url: string, payload: unknown): Promise<T> {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  return parse<T>(res);
}

/** GET a JSON API route; `url = null` skips the request. Keeps the previous data while reloading. */
export function useApi<T>(url: string | null) {
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<{ key: string | null; data: T | null; error: ApiClientError | null }>({ key: null, data: null, error: null });
  const key = url ? `${url}#${tick}` : null;

  useEffect(() => {
    if (!url || !key) return;
    let cancelled = false;
    fetch(url, { cache: "no-store" })
      .then((res) => parse<T>(res))
      .then((body) => { if (!cancelled) setState({ key, data: body, error: null }); })
      .catch((err) => {
        if (!cancelled) setState((s) => ({ key, data: s.data, error: err instanceof ApiClientError ? err : new ApiClientError(0, String(err)) }));
      });
    return () => { cancelled = true; };
  }, [url, key]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data: state.data, error: state.error, loading: key !== null && state.key !== key, reload };
}
