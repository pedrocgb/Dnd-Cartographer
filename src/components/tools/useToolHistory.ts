"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { readStored, writeStored } from "@/components/stored";
import { addToHistory, pruneHistory, type HistoryItem } from "@/lib/tool-history";

const CHANGE_EVENT = "tool-history-change";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/**
 * An Advanced Tool's recent results, kept in this browser under `key` (see
 * lib/tool-history for the limit and expiry). `parse` reads the stored list.
 */
export function useToolHistory<T extends HistoryItem>(key: string, parse: (raw: string | null) => T[]) {
  const raw = useSyncExternalStore(subscribe, () => readStored(key), () => null);
  const entries = useMemo(() => parse(raw), [parse, raw]);

  const save = useCallback(
    (update: (entries: T[]) => T[]) => {
      writeStored(key, JSON.stringify(update(parse(readStored(key)))));
      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
    [key, parse]
  );

  // Expired entries go when the page opens.
  useEffect(() => save((current) => pruneHistory(current, Date.now())), [save]);

  const add = useCallback((entry: T) => save((current) => addToHistory(current, entry, Date.now())), [save]);

  return { entries, add, save };
}
