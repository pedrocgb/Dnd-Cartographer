"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/components/calendars/api";
import type { ClientLegend, LegendConfig } from "@/server/legends/legend-config";

const SAVE_DELAY_MS = 250;

export interface LegendPatch {
  visible?: boolean;
  extraLayerIds?: string[];
  config?: Partial<LegendConfig>;
}

export interface MapLegendsApi {
  legends: ClientLegend[];
  /** False until this map's legends have arrived. */
  loaded: boolean;
  create: (layerId: string) => Promise<void>;
  /** Applies at once on screen; saves shortly after (rapid edits — drags, sliders, typing — go out as one request). */
  update: (layerId: string, patch: LegendPatch) => void;
  remove: (layerId: string) => Promise<void>;
  error: string | null;
}

/** The map's layer legends, loaded once, edited optimistically. */
export function useMapLegends(mapId: string): MapLegendsApi {
  const [legends, setLegends] = useState<ClientLegend[]>([]);
  const [error, setError] = useState<string | null>(null);
  // The map whose legends have arrived (the Legend panel shows a skeleton until then).
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const pending = useRef(new Map<string, { patch: LegendPatch; timer: ReturnType<typeof setTimeout> }>());

  useEffect(() => {
    let cancelled = false;
    void api<{ legends: ClientLegend[] }>("GET", `/api/maps/${mapId}/legends`).then((res) => {
      if (cancelled) return;
      if (res.ok) setLegends(res.data.legends);
      setLoadedFor(mapId);
    });
    return () => {
      cancelled = true;
    };
  }, [mapId]);

  // Unsaved edits still go out when the map closes.
  useEffect(() => {
    const queue = pending.current;
    return () => {
      for (const [layerId, { patch, timer }] of queue) {
        clearTimeout(timer);
        void api("PATCH", `/api/layers/${layerId}/legend`, patch);
      }
      queue.clear();
    };
  }, []);

  const create = useCallback(async (layerId: string) => {
    const res = await api<{ legend: ClientLegend | null }>("POST", `/api/layers/${layerId}/legend`);
    const legend = res.data.legend;
    if (!res.ok || !legend) return setError(res.data.error ?? "Could not create the legend.");
    setError(null);
    setLegends((prev) => [...prev.filter((l) => l.layerId !== layerId), legend]);
  }, []);

  const update = useCallback((layerId: string, patch: LegendPatch) => {
    setLegends((prev) =>
      prev.map((l) => (l.layerId === layerId ? { ...l, ...patch, config: patch.config ? { ...l.config, ...patch.config } : l.config } : l))
    );
    const queue = pending.current;
    const before = queue.get(layerId);
    if (before) clearTimeout(before.timer);
    const merged: LegendPatch = { ...before?.patch, ...patch, config: before?.patch.config || patch.config ? { ...before?.patch.config, ...patch.config } : undefined };
    const timer = setTimeout(async () => {
      queue.delete(layerId);
      const res = await api<{ legend: ClientLegend }>("PATCH", `/api/layers/${layerId}/legend`, merged);
      if (!res.ok) setError(res.data.error ?? "Could not save the legend.");
      else setError(null);
    }, SAVE_DELAY_MS);
    queue.set(layerId, { patch: merged, timer });
  }, []);

  const remove = useCallback(async (layerId: string) => {
    const queued = pending.current.get(layerId);
    if (queued) clearTimeout(queued.timer);
    pending.current.delete(layerId);
    const res = await api("DELETE", `/api/layers/${layerId}/legend`);
    if (!res.ok) return setError(res.data.error ?? "Could not delete the legend.");
    setLegends((prev) => prev.filter((l) => l.layerId !== layerId));
  }, []);

  return { legends, loaded: loadedFor === mapId, create, update, remove, error };
}
