import { parseLayerIds } from "../layers/layer-ids";
import { normalizeColor } from "../markers/icon-registry";
import { sanitizeTravelSettings, type TravelSettings } from "./travel";

/**
 * Saved travel routes (map_routes): look, geometry and the travel settings
 * their trip time uses. Pure (relative imports only) so the client shares
 * the same limits.
 */

export const ROUTE_STYLES = ["solid", "dashed", "dotted"] as const;
export type RouteStyleKind = (typeof ROUTE_STYLES)[number];

export const MAX_ROUTE_POINTS = 2000;
export const MAX_ROUTE_NAME = 120;
/** Line width in screen pixels (routes keep their width at any zoom). */
export const ROUTE_WIDTH: [number, number] = [1, 12];

export interface RouteStyle {
  color: string;
  width: number;
  style: RouteStyleKind;
}

export const DEFAULT_ROUTE_STYLE: RouteStyle = { color: "#FACC15", width: 3, style: "dashed" };

export interface RoutePt {
  x: number;
  y: number;
}

/** A route as the API returns it. */
export interface MapRouteData extends RouteStyle {
  id: string;
  mapId: string;
  layerId: string;
  extraLayerIds: string[];
  groupId: string | null;
  name: string;
  points: RoutePt[];
  settings: TravelSettings;
  visible: boolean;
  locked: boolean;
  sortOrder: number;
}

/** The style keys present and valid in `body`. */
export function sanitizeRouteStyle(body: Record<string, unknown>): Partial<RouteStyle> {
  const out: Partial<RouteStyle> = {};
  if (typeof body.color === "string") out.color = normalizeColor(body.color, DEFAULT_ROUTE_STYLE.color);
  if (typeof body.width === "number" && Number.isFinite(body.width)) out.width = Math.min(ROUTE_WIDTH[1], Math.max(ROUTE_WIDTH[0], body.width));
  if (typeof body.style === "string" && (ROUTE_STYLES as readonly string[]).includes(body.style)) out.style = body.style as RouteStyleKind;
  return out;
}

/** 2..MAX_ROUTE_POINTS finite points, clamped into the frame; null when invalid. */
export function sanitizeRoutePoints(raw: unknown, frame: { width: number; height: number }): RoutePt[] | null {
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > MAX_ROUTE_POINTS) return null;
  const out: RoutePt[] = [];
  for (const p of raw) {
    if (!p || typeof p !== "object") return null;
    const { x, y } = p as Record<string, unknown>;
    if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) return null;
    out.push({ x: Math.min(frame.width, Math.max(0, x)), y: Math.min(frame.height, Math.max(0, y)) });
  }
  return out;
}

export const sanitizeRouteName = (raw: unknown) => (typeof raw === "string" ? raw.trim().slice(0, MAX_ROUTE_NAME) : null);

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

type RouteRow = Omit<MapRouteData, "extraLayerIds" | "points" | "settings" | "style"> & { extraLayerIds: string; points: string; settings: string; style: string };

export function toClientRoute(row: RouteRow): MapRouteData {
  const points = parseJson(row.points);
  return {
    id: row.id,
    mapId: row.mapId,
    layerId: row.layerId,
    extraLayerIds: parseLayerIds(row.extraLayerIds),
    groupId: row.groupId,
    name: row.name,
    points: Array.isArray(points) ? (points as RoutePt[]) : [],
    color: row.color,
    width: row.width,
    style: (ROUTE_STYLES as readonly string[]).includes(row.style) ? (row.style as RouteStyleKind) : "dashed",
    settings: sanitizeTravelSettings(parseJson(row.settings)),
    visible: row.visible,
    locked: row.locked,
    sortOrder: row.sortOrder,
  };
}
