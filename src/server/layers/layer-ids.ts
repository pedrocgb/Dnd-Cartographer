/**
 * "Also show on" layers of a marker/zone/text/line: stored as a JSON string[]
 * in each table's `extra_layer_ids` column (same convention as
 * markers.status_tags), parsed at the API boundary.
 */

export function parseLayerIds(raw: unknown): string[] {
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function encodeLayerIds(ids: string[]): string {
  return JSON.stringify(ids);
}

/**
 * Keeps only real layers of the map, drops the item's own (home) layer and
 * duplicates, keeping the given order. Returns null when `raw` isn't an array.
 */
export function normalizeExtraLayerIds(raw: unknown, mapLayerIds: Set<string>, homeLayerId: string | null): string[] | null {
  if (!Array.isArray(raw)) return null;
  const out: string[] = [];
  for (const id of raw) {
    if (typeof id !== "string" || !mapLayerIds.has(id) || id === homeLayerId || out.includes(id)) continue;
    out.push(id);
  }
  return out;
}

/** API response shape: the stored JSON text replaced by the parsed list. */
export function withLayerIds<T extends { extraLayerIds: string }>(row: T): Omit<T, "extraLayerIds"> & { extraLayerIds: string[] } {
  return { ...row, extraLayerIds: parseLayerIds(row.extraLayerIds) };
}
