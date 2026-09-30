import { isValidIconKey, normalizeColor, DEFAULT_ICON_KEY } from "../markers/icon-registry";
import { ARTICLE_IMAGE_KEY, ARTICLE_IMAGE_URL_PREFIX } from "../documents/rich-attrs";

/**
 * A map legend's content and look, stored as JSON in map_legends.config.
 * Pure (relative imports only) so the client can use the same defaults.
 */

export const LEGEND_ITEM_SIZES = ["small", "medium", "large"] as const;
export type LegendItemSize = (typeof LEGEND_ITEM_SIZES)[number];

export const LEGEND_LIMITS = {
  columns: [1, 6],
  rows: [1, 20],
  items: 100,
  title: 80,
  text: 120,
  itemId: 40,
} as const;

export type LegendImage = { kind: "icon"; key: string; color: string; fill: string } | { kind: "upload"; src: string };

export interface LegendItem {
  id: string;
  image: LegendImage;
  text: string;
  bold: boolean;
  italic: boolean;
  strike: boolean;
}

/** Where a screen-pinned widget sits: its top-left, as fractions (0..1) of the map window. */
export interface HudPosition {
  x: number;
  y: number;
}

export interface LegendConfig {
  title: string | null;
  /** Most items side by side; the legend is only as wide as its items need. */
  columns: number;
  /** Most rows shown at once; more items scroll inside the legend. */
  rows: number;
  itemSize: LegendItemSize;
  /** Backing plate opacity, 0..1. */
  background: number;
  position: HudPosition;
  items: LegendItem[];
}

/** A legend as the API returns it (map_legends row, layer ids and config parsed). */
export interface ClientLegend {
  id: string;
  mapId: string;
  layerId: string;
  extraLayerIds: string[];
  visible: boolean;
  config: LegendConfig;
}

export const DEFAULT_LEGEND: LegendConfig = {
  title: "Legend",
  columns: 1,
  rows: 8,
  itemSize: "medium",
  background: 0.85,
  // Bottom-left corner (pushed back into view on screen).
  position: { x: 0, y: 1 },
  items: [],
};

const DEFAULT_ICON_COLOR = "#FFFFFF";
const DEFAULT_ICON_FILL = "#3B82F6";
export const DEFAULT_ITEM_ICON: LegendImage = { kind: "icon", key: DEFAULT_ICON_KEY, color: DEFAULT_ICON_COLOR, fill: DEFAULT_ICON_FILL };

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === "string" && (list as readonly string[]).includes(v);
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const cleanText = (v: string, max: number) => v.replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, max);

/** An uploaded legend image: only ever one of our own article-image URLs. */
export function isLegendImageSrc(src: unknown): src is string {
  return typeof src === "string" && src.startsWith(ARTICLE_IMAGE_URL_PREFIX) && ARTICLE_IMAGE_KEY.test(src.slice(ARTICLE_IMAGE_URL_PREFIX.length));
}

export function sanitizePosition(raw: unknown, fallback: HudPosition): HudPosition {
  if (!isObject(raw)) return fallback;
  const x = num(raw.x);
  const y = num(raw.y);
  return { x: x === null ? fallback.x : clamp(x, 0, 1), y: y === null ? fallback.y : clamp(y, 0, 1) };
}

function sanitizeImage(raw: unknown): LegendImage | null {
  if (!isObject(raw)) return null;
  if (raw.kind === "upload") return isLegendImageSrc(raw.src) ? { kind: "upload", src: raw.src } : null;
  if (raw.kind !== "icon" || typeof raw.key !== "string" || !isValidIconKey(raw.key)) return null;
  return {
    kind: "icon",
    key: raw.key,
    color: normalizeColor(typeof raw.color === "string" ? raw.color : "", DEFAULT_ICON_COLOR),
    fill: normalizeColor(typeof raw.fill === "string" ? raw.fill : "", DEFAULT_ICON_FILL),
  };
}

function sanitizeItem(raw: unknown): LegendItem | null {
  if (!isObject(raw) || typeof raw.id !== "string" || !/^[A-Za-z0-9_-]{1,40}$/.test(raw.id)) return null;
  const image = sanitizeImage(raw.image);
  if (!image) return null;
  return {
    id: raw.id,
    image,
    text: typeof raw.text === "string" ? cleanText(raw.text, LEGEND_LIMITS.text) : "",
    bold: raw.bold === true,
    italic: raw.italic === true,
    strike: raw.strike === true,
  };
}

/** Items kept valid and unique by id, in order, up to the limit. */
function sanitizeItems(raw: unknown): LegendItem[] | null {
  if (!Array.isArray(raw)) return null;
  const out: LegendItem[] = [];
  for (const entry of raw) {
    const item = sanitizeItem(entry);
    if (item && !out.some((i) => i.id === item.id)) out.push(item);
    if (out.length >= LEGEND_LIMITS.items) break;
  }
  return out;
}

/**
 * `current` with every valid key of `patch` applied (invalid ones are
 * dropped, numbers clamped). Also used on read with DEFAULT_LEGEND as
 * `current`, so a stored config missing keys still comes back complete.
 */
export function applyLegendPatch(current: LegendConfig, patch: unknown): LegendConfig {
  if (!isObject(patch)) return current;
  const next: LegendConfig = { ...current };
  if (patch.title === null) next.title = null;
  else if (typeof patch.title === "string") next.title = cleanText(patch.title, LEGEND_LIMITS.title).trim() || null;
  const columns = num(patch.columns);
  if (columns !== null) next.columns = Math.round(clamp(columns, ...LEGEND_LIMITS.columns));
  const rows = num(patch.rows);
  if (rows !== null) next.rows = Math.round(clamp(rows, ...LEGEND_LIMITS.rows));
  if (oneOf(LEGEND_ITEM_SIZES, patch.itemSize)) next.itemSize = patch.itemSize;
  const background = num(patch.background);
  if (background !== null) next.background = clamp(background, 0, 1);
  if ("position" in patch) next.position = sanitizePosition(patch.position, current.position);
  const items = sanitizeItems(patch.items);
  if (items) next.items = items;
  return next;
}

/** The stored JSON text as a complete config (corrupt text gives the defaults). */
export function parseLegendConfig(json: string): LegendConfig {
  try {
    return applyLegendPatch(DEFAULT_LEGEND, JSON.parse(json));
  } catch {
    return DEFAULT_LEGEND;
  }
}
