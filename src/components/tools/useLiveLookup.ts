"use client";

import { useEffect, useState } from "react";

/**
 * Asks the server about the ids a tool's history points at (do these
 * articles or calendar attachments still exist?). `null` until the answer
 * comes; asked again whenever the tab regains focus, so something deleted
 * or restored meanwhile shows up right. No ids, no request. Pass `url` and
 * `read` as module-level functions so they stay the same between renders.
 */
export function useLiveLookup<T>(ids: string[], url: (query: string) => string, read: (data: unknown) => T | null): T | null {
  const query = ids.join(",");
  const [result, setResult] = useState<{ query: string; value: T } | null>(null);

  useEffect(() => {
    if (!query) return;
    let cancelled = false;
    const check = () =>
      fetch(url(encodeURIComponent(query)))
        .then((res) => (res.ok ? res.json() : null))
        .then((data: unknown) => {
          const value = read(data);
          if (!cancelled && value !== null) setResult({ query, value });
        })
        .catch(() => {
          // offline: keep what we knew
        });
    check();
    const onVisible = () => document.visibilityState === "visible" && check();
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [query, url, read]);

  return result?.query === query ? result.value : null;
}
