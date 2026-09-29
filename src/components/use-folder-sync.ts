"use client";

import { useCallback, useRef } from "react";
import type { FolderPatch, MapFolderData } from "./LayerFolders";

const SAVE_DELAY = 250;

/**
 * Optimistic folder edits: applied locally at once, saved shortly after and
 * merged per folder, so dragging a default-style slider sends one request
 * instead of dozens and no field of a burst is lost.
 */
export function useFolderSync<T extends MapFolderData>(setFolders: React.Dispatch<React.SetStateAction<T[]>>, urlOf: (id: string) => string) {
  const pending = useRef(new Map<string, FolderPatch>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  return useCallback(
    (id: string, patch: FolderPatch) => {
      setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
      const merged = { ...(pending.current.get(id) ?? {}), ...patch };
      pending.current.set(id, merged);
      clearTimeout(timers.current.get(id));
      timers.current.set(
        id,
        setTimeout(() => {
          pending.current.delete(id);
          void fetch(urlOf(id), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(merged) });
        }, SAVE_DELAY)
      );
    },
    [setFolders, urlOf]
  );
}
