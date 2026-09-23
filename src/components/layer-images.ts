"use client";

import { useEffect, useRef } from "react";
import type OpenSeadragonType from "openseadragon";

export interface MapLayerData {
  id: string;
  mapId: string;
  name: string;
  /** Lower = higher in the list = drawn on top. */
  sortOrder: number;
  visible: boolean;
  imageOpacity: number;
  imageAlwaysVisible: boolean;
  /** Draw this layer's zones/markers/texts/lines even while another layer is active (display only). */
  zonesAlwaysVisible: boolean;
  markersAlwaysVisible: boolean;
  textsAlwaysVisible: boolean;
  linesAlwaysVisible: boolean;
  /** The layer's current (tiled, ready) image, if any. */
  asset: { id: string; width: number | null; height: number | null } | null;
  /** A newer upload still being processed (or that failed). */
  pendingAsset: { id: string; state: "uploading" | "queued" | "processing" | "failed" } | null;
}

export type LayerPatch = Partial<
  Pick<
    MapLayerData,
    "name" | "visible" | "imageOpacity" | "imageAlwaysVisible" | "zonesAlwaysVisible" | "markersAlwaysVisible" | "textsAlwaysVisible" | "linesAlwaysVisible"
  >
>;

export type AlwaysDrawFlag = "zonesAlwaysVisible" | "markersAlwaysVisible" | "textsAlwaysVisible" | "linesAlwaysVisible";

/**
 * Layers whose items of one kind are drawn, in paint order (first = bottom):
 * the active layer plus every layer with that kind's "always draw" flag,
 * skipping hidden layers — same stacking rule as drawnImages.
 */
export function drawnLayerIds(layers: MapLayerData[], activeLayerId: string | null, flag: AlwaysDrawFlag): string[] {
  return sortLayers(layers)
    .reverse()
    .filter((l) => l.visible && (l.id === activeLayerId || l[flag]))
    .map((l) => l.id);
}

/**
 * Items drawn for `layerIds` (see drawnLayerIds), ordered by that paint order
 * (stable within a layer). An item counts for its home layer, or — when given
 * `shared` — for the active layer if it is also shown there ("Also show on").
 */
export function itemsInLayers<T>(
  items: T[],
  layerOf: (item: T) => string | null,
  layerIds: string[],
  shared?: { extrasOf: (item: T) => readonly string[] | undefined; activeLayerId: string }
): T[] {
  const rank = new Map(layerIds.map((id, i) => [id, i]));
  const drawnFor = (item: T) =>
    shared && shared.extrasOf(item)?.includes(shared.activeLayerId) && rank.has(shared.activeLayerId)
      ? shared.activeLayerId
      : layerOf(item) ?? "";
  return items
    .map((item, i) => ({ item, i, r: rank.get(drawnFor(item)) }))
    .filter((x): x is { item: T; i: number; r: number } => x.r !== undefined)
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.item);
}

/** True when an item with this home layer and "also show on" list belongs on `layerId`. */
export function isOnLayer(homeLayerId: string | null, extraLayerIds: readonly string[] | undefined, layerId: string): boolean {
  return homeLayerId === layerId || Boolean(extraLayerIds?.includes(layerId));
}

/**
 * A patch that moves an item's home layer also drops the new home from its
 * "Also show on" list (the server does the same), so local state matches.
 */
export function withHomeLayer<P extends { layerId?: string | null; extraLayerIds?: string[] }>(patch: P, currentExtras: readonly string[] | undefined): P {
  if (!patch.layerId) return patch;
  return { ...patch, extraLayerIds: (patch.extraLayerIds ?? currentExtras ?? []).filter((id) => id !== patch.layerId) };
}

export interface DrawnImage {
  layerId: string;
  assetId: string;
  opacity: number;
}

/** Layers in list order (top of the list first). */
export function sortLayers<T extends { sortOrder: number }>(layers: T[]): T[] {
  return [...layers].sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Images to draw for the active layer, in paint order (first = bottom): the
 * active layer's own image plus every "always draw" image, skipping hidden
 * layers. The bottom of the layer list paints first, so the top ends up on top.
 */
export function drawnImages(layers: MapLayerData[], activeLayerId: string | null): DrawnImage[] {
  return sortLayers(layers)
    .reverse()
    .filter((l) => l.visible && l.asset && (l.id === activeLayerId || l.imageAlwaysVisible))
    .map((l) => ({ layerId: l.id, assetId: l.asset!.id, opacity: l.imageOpacity }));
}

/** Moves `draggedId` to `targetId`'s slot and returns the new id order. */
export function moveLayer(orderedIds: string[], draggedId: string, targetId: string): string[] {
  if (draggedId === targetId) return orderedIds;
  const without = orderedIds.filter((id) => id !== draggedId);
  const targetIdx = without.indexOf(targetId);
  if (targetIdx < 0) return orderedIds;
  const fromIdx = orderedIds.indexOf(draggedId);
  const toIdx = orderedIds.indexOf(targetId);
  // Dragging down lands after the target, dragging up lands before it.
  const insertAt = fromIdx < toIdx ? targetIdx + 1 : targetIdx;
  return [...without.slice(0, insertAt), draggedId, ...without.slice(insertAt)];
}

/**
 * Keeps the viewer's tiled images in sync with the drawn layer images.
 * World item 0 is always the invisible frame item every overlay layer uses as
 * its coordinate reference (`world.getItemAt(0)`); layer images sit above it
 * at index 1+, stretched over the same bounds (x 0, width 1 — the worker
 * already resized them to the frame's pixel size).
 */
export function useLayerImages(viewer: OpenSeadragonType.Viewer | null, layers: MapLayerData[], activeLayerId: string | null) {
  const itemsRef = useRef(new Map<string, OpenSeadragonType.TiledImage | "loading">());
  const wantedRef = useRef<DrawnImage[]>([]);

  // A new viewer starts with an empty world.
  useEffect(() => {
    const items = itemsRef.current;
    return () => items.clear();
  }, [viewer]);

  useEffect(() => {
    if (!viewer) return;
    const v = viewer;
    const items = itemsRef.current;
    const wanted = drawnImages(layers, activeLayerId);
    wantedRef.current = wanted;
    const wantedIds = new Set(wanted.map((w) => w.assetId));

    function applyOrder() {
      let index = 1;
      for (const w of wantedRef.current) {
        const item = items.get(w.assetId);
        if (!item || item === "loading") continue;
        item.setOpacity(w.opacity);
        if (v.world.getIndexOfItem(item) !== index) v.world.setItemIndex(item, index);
        index += 1;
      }
    }

    for (const [assetId, item] of items) {
      if (wantedIds.has(assetId)) continue;
      if (item !== "loading") v.world.removeItem(item);
      items.delete(assetId);
    }

    for (const w of wanted) {
      if (items.has(w.assetId)) continue;
      items.set(w.assetId, "loading");
      v.addTiledImage({
        tileSource: `/api/tiles/${w.assetId}/manifest.dzi`,
        x: 0,
        y: 0,
        width: 1,
        opacity: w.opacity,
        success: (e) => {
          const event = e as unknown as { item: OpenSeadragonType.TiledImage };
          // Dropped (layer switched, image replaced) while it was loading.
          if (!wantedRef.current.some((x) => x.assetId === w.assetId) || items.get(w.assetId) !== "loading") {
            v.world.removeItem(event.item);
            return;
          }
          items.set(w.assetId, event.item);
          applyOrder();
        },
        error: () => items.delete(w.assetId),
      });
    }

    applyOrder();
  }, [viewer, layers, activeLayerId]);
}
