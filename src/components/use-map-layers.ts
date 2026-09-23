"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sortLayers, type LayerPatch, type MapLayerData } from "./layer-images";

const POLL_MS = 1200;

function isProcessing(layer: MapLayerData): boolean {
  const state = layer.pendingAsset?.state;
  return state === "uploading" || state === "queued" || state === "processing";
}

/**
 * The map's layers plus which one is active. Every map has at least one
 * layer; the active layer falls back to the top of the list when unset or
 * deleted. Polls while any layer image is still being tiled.
 */
export function useMapLayers(mapId: string) {
  const [layers, setLayers] = useState<MapLayerData[]>([]);
  const [chosenLayerId, setActiveLayerId] = useState<string | null>(null);
  const patchTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const cancelledRef = useRef(false);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/maps/${mapId}/layers`, { cache: "no-store" });
    if (!res.ok || cancelledRef.current) return;
    const data: { layers: MapLayerData[] } = await res.json();
    if (!cancelledRef.current) setLayers(data.layers);
  }, [mapId]);

  useEffect(() => {
    cancelledRef.current = false;
    void refresh();
    const timers = patchTimersRef.current;
    return () => {
      cancelledRef.current = true;
      for (const t of timers.values()) clearTimeout(t);
    };
  }, [refresh]);

  // Re-armed by every refresh (new `layers` array) until nothing is processing.
  const processing = layers.some(isProcessing);
  useEffect(() => {
    if (!processing) return;
    const timer = setTimeout(() => void refresh(), POLL_MS);
    return () => clearTimeout(timer);
  }, [processing, layers, refresh]);

  const sorted = sortLayers(layers);
  const activeLayerId = sorted.some((l) => l.id === chosenLayerId) ? chosenLayerId : (sorted[0]?.id ?? null);

  async function createLayer() {
    const res = await fetch(`/api/maps/${mapId}/layers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (!res.ok) return;
    const data: { layers: MapLayerData[] } = await res.json();
    const known = new Set(layers.map((l) => l.id));
    setLayers(data.layers);
    const created = data.layers.find((l) => !known.has(l.id));
    if (created) setActiveLayerId(created.id);
  }

  /** Optimistic; sliders (opacity) are debounced like grid/zone slider edits. */
  function updateLayer(id: string, patch: LayerPatch) {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    const send = () =>
      fetch(`/api/layers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    const timers = patchTimersRef.current;
    clearTimeout(timers.get(id));
    if ("imageOpacity" in patch) timers.set(id, setTimeout(send, 250));
    else void send();
  }

  function reorderLayers(orderedIds: string[]) {
    const order = new Map(orderedIds.map((id, i) => [id, i]));
    setLayers((prev) => prev.map((l) => ({ ...l, sortOrder: order.get(l.id) ?? l.sortOrder })));
    void fetch(`/api/maps/${mapId}/layers/order`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: orderedIds }),
    });
  }

  /** Returns the server response so the caller can handle the 409 "still has content" case. */
  async function deleteLayer(id: string, cascade: boolean): Promise<Response> {
    const res = await fetch(`/api/layers/${id}${cascade ? "?mode=cascade" : ""}`, { method: "DELETE" });
    if (res.ok) setLayers((prev) => prev.filter((l) => l.id !== id));
    return res;
  }

  async function uploadLayerImage(id: string, file: File): Promise<string | null> {
    const res = await fetch(`/api/layers/${id}/image`, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!res.ok) return (await res.json().catch(() => ({}))).error ?? "Upload failed.";
    await refresh();
    return null;
  }

  async function removeLayerImage(id: string) {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, asset: null } : l)));
    await fetch(`/api/layers/${id}/image`, { method: "DELETE" });
  }

  async function retryLayerImage(assetId: string) {
    await fetch(`/api/assets/${assetId}/retry`, { method: "POST" });
    await refresh();
  }

  return {
    layers: sorted,
    activeLayerId,
    setActiveLayerId,
    refresh,
    createLayer,
    updateLayer,
    reorderLayers,
    deleteLayer,
    uploadLayerImage,
    removeLayerImage,
    retryLayerImage,
  };
}

export type MapLayersApi = ReturnType<typeof useMapLayers>;
