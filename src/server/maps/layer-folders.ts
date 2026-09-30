import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { lineGroups, mapLines, mapRoutes, mapTexts, maps, routeGroups, textGroups } from "@/server/db/schema";
import { sanitizeExtraLayerIds } from "@/server/layers/layers";
import { parseLayerIds } from "@/server/layers/layer-ids";
import { sanitizeLinePatch } from "@/server/lines/line-config";
import { sanitizeTextPatch } from "@/server/texts/text-config";
import { clampOpacity, clampStrokeWidth, normalizeColor } from "@/server/zones/zone-config";
import { sanitizeRouteStyle } from "@/server/travel/route-config";
import { sanitizeTravelSettings } from "@/server/travel/travel";

/**
 * Map folders: zone regions, line, text and route groups share one shape
 * (name, visible, locked, order, "Also show on" layers, a default style for
 * new items). Hiding or locking a folder hides or locks what's in it; its
 * extra layers add to each item's own.
 */

export type FolderKind = "zone" | "line" | "text" | "route";
/** Folder kinds whose items live in their own table with a `groupId`. */
export type GroupedKind = Exclude<FolderKind, "zone">;

// Same columns in every pair (see schema.ts), so the line tables' types describe them all.
export const folderTable = (kind: GroupedKind) =>
  (kind === "line" ? lineGroups : kind === "text" ? textGroups : routeGroups) as unknown as typeof lineGroups;
export const itemTable = (kind: GroupedKind) =>
  (kind === "line" ? mapLines : kind === "text" ? mapTexts : mapRoutes) as unknown as typeof mapLines;

export const MAX_FOLDER_NAME = 120;

/** A trimmed, capped name ("" when not a string). */
export const sanitizeFolderName = (raw: unknown) => (typeof raw === "string" ? raw.trim().slice(0, MAX_FOLDER_NAME) : "");

type Frame = { width: number; height: number };

const TEXT_CONTENT_KEYS = ["text", "x", "y"] as const;

function sanitizeZoneStyle(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
  if (typeof raw.fillColor === "string") out.fillColor = normalizeColor(raw.fillColor, "#FFFFFF");
  if (typeof raw.strokeColor === "string") out.strokeColor = normalizeColor(raw.strokeColor, "#FFFFFF");
  if (num(raw.fillOpacity)) out.fillOpacity = clampOpacity(raw.fillOpacity);
  if (num(raw.strokeOpacity)) out.strokeOpacity = clampOpacity(raw.strokeOpacity);
  if (num(raw.strokeWidth)) out.strokeWidth = clampStrokeWidth(raw.strokeWidth);
  return out;
}

/** The validated default style as stored JSON, null to clear it, undefined when invalid. */
export function sanitizeDefaultStyle(kind: FolderKind, raw: unknown, frame: Frame | null): string | null | undefined {
  if (raw === null) return null;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const body = raw as Record<string, unknown>;
  let style: Record<string, unknown>;
  if (kind === "zone") style = sanitizeZoneStyle(body);
  else if (kind === "route") {
    style = { ...sanitizeRouteStyle(body) };
    if (body.settings && typeof body.settings === "object") style.settings = sanitizeTravelSettings(body.settings);
  } else if (!frame) return undefined;
  else if (kind === "line") style = { ...sanitizeLinePatch(body, frame) };
  else {
    style = { ...sanitizeTextPatch(body, frame) };
    for (const key of TEXT_CONTENT_KEYS) delete style[key];
  }
  return Object.keys(style).length ? JSON.stringify(style) : null;
}

export interface FolderRow {
  mapId: string;
  layerId: string | null;
  extraLayerIds: string;
  defaultStyle: string | null;
}

/**
 * The folder fields present and valid in `body`, ready for an update. Returns
 * an error message instead when "Also show on" or the default style is invalid.
 */
export async function folderPatch(kind: FolderKind, body: Record<string, unknown>, folder: FolderRow) {
  const patch: {
    updatedAt: Date;
    name?: string;
    visible?: boolean;
    locked?: boolean;
    sortOrder?: number;
    extraLayerIds?: string;
    defaultStyle?: string | null;
  } = { updatedAt: new Date() };
  const name = sanitizeFolderName(body.name);
  if (name) patch.name = name;
  if (typeof body.visible === "boolean") patch.visible = body.visible;
  if (typeof body.locked === "boolean") patch.locked = body.locked;
  if (typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)) patch.sortOrder = Math.round(body.sortOrder);
  if ("extraLayerIds" in body) {
    const encoded = await sanitizeExtraLayerIds(body.extraLayerIds, folder.mapId, folder.layerId);
    if (encoded === null) return { error: "extraLayerIds must be a list of layer ids." };
    patch.extraLayerIds = encoded;
  }
  if ("defaultStyle" in body) {
    const map = kind === "zone" || kind === "route" ? null : await db.query.maps.findFirst({ where: eq(maps.id, folder.mapId) });
    const frame = map?.frameWidth && map.frameHeight ? { width: map.frameWidth, height: map.frameHeight } : null;
    const style = sanitizeDefaultStyle(kind, body.defaultStyle, frame);
    if (style === undefined) return { error: "defaultStyle must be a style object or null." };
    patch.defaultStyle = style;
  }
  return { patch };
}

function parseStyle(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** API response shape: the stored JSON columns parsed. */
export function toClientFolder<T extends { extraLayerIds: string; defaultStyle: string | null }>(row: T) {
  return { ...row, extraLayerIds: parseLayerIds(row.extraLayerIds), defaultStyle: parseStyle(row.defaultStyle) };
}

/**
 * Checks a line's or text's folder: null (Ungrouped) is always fine;
 * otherwise a live folder of the same map and home layer, unlocked for
 * `forWrite`. Returns an error message, or null when valid.
 */
export async function folderError(kind: GroupedKind, groupId: unknown, mapId: string, layerId: string | null, forWrite = true): Promise<string | null> {
  if (groupId === null) return null;
  if (typeof groupId !== "string") return "groupId must be a folder id or null.";
  const table = folderTable(kind);
  const [group] = await db.select().from(table).where(and(eq(table.id, groupId), isNull(table.deletedAt)));
  if (!group || group.mapId !== mapId) return "Folder not found on this map.";
  if (group.layerId !== layerId) return "The folder is on another layer.";
  if (forWrite && group.locked) return "The folder is locked.";
  return null;
}

/** True when the item's current folder is live and locked (leaving it is refused). */
export async function inLockedFolder(kind: GroupedKind, groupId: string | null): Promise<boolean> {
  if (!groupId) return false;
  const table = folderTable(kind);
  const [group] = await db.select().from(table).where(eq(table.id, groupId));
  return Boolean(group?.locked && !group.deletedAt);
}

/** New items go on top of their folder (lowest sort order first). */
export async function topSortOrder(kind: GroupedKind, mapId: string, groupId: string | null): Promise<number> {
  const table = itemTable(kind);
  const rows = await db
    .select({ sortOrder: table.sortOrder })
    .from(table)
    .where(and(eq(table.mapId, mapId), groupId ? eq(table.groupId, groupId) : isNull(table.groupId), isNull(table.deletedAt)));
  return rows.length ? Math.min(...rows.map((r) => r.sortOrder)) - 1 : 0;
}
