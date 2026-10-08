"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/components/calendars/api";
import { DEFAULT_SCALE, type ScaleConfig } from "@/server/scale/scale-config";
import { activeT } from "@/i18n/active";

const SAVE_DELAY_MS = 250;

export interface ScaleBarState {
  visible: boolean;
  config: ScaleConfig;
}

export interface ScaleBarPatch {
  visible?: boolean;
  config?: Partial<ScaleConfig>;
}

/** The map's scale bar (hidden and uncalibrated until set up), edited optimistically. */
export function useMapScaleBar(mapId: string) {
  const [scaleBar, setScaleBar] = useState<ScaleBarState>({ visible: false, config: DEFAULT_SCALE });
  const [error, setError] = useState<string | null>(null);
  // The map whose scale bar has arrived (the Scale panel shows a skeleton until then).
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const pending = useRef<{ patch: ScaleBarPatch; timer: ReturnType<typeof setTimeout> } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void api<{ scaleBar: ScaleBarState }>("GET", `/api/maps/${mapId}/scale-bar`).then((res) => {
      if (cancelled) return;
      if (res.ok) setScaleBar(res.data.scaleBar);
      setLoadedFor(mapId);
    });
    return () => {
      cancelled = true;
      const queued = pending.current;
      if (queued) {
        clearTimeout(queued.timer);
        void api("PUT", `/api/maps/${mapId}/scale-bar`, queued.patch);
        pending.current = null;
      }
    };
  }, [mapId]);

  const update = useCallback(
    (patch: ScaleBarPatch) => {
      setScaleBar((prev) => ({ visible: patch.visible ?? prev.visible, config: patch.config ? { ...prev.config, ...patch.config } : prev.config }));
      const before = pending.current;
      if (before) clearTimeout(before.timer);
      const merged: ScaleBarPatch = { ...before?.patch, ...patch, config: before?.patch.config || patch.config ? { ...before?.patch.config, ...patch.config } : undefined };
      const timer = setTimeout(async () => {
        pending.current = null;
        const res = await api("PUT", `/api/maps/${mapId}/scale-bar`, merged);
        setError(res.ok ? null : (res.data.error ?? activeT("maps")("error.saveScaleBar")));
      }, SAVE_DELAY_MS);
      pending.current = { patch: merged, timer };
    },
    [mapId]
  );

  return { scaleBar, loaded: loadedFor === mapId, update, error };
}

export type MapScaleBarApi = ReturnType<typeof useMapScaleBar>;
