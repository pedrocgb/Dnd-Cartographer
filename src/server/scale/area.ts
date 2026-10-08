/**
 * Area and perimeter of map shapes (frame pixels) and their reading in real
 * units through the map's scale calibration. Pure: shared by the Area tool
 * and the Zones panel (each zone's live area).
 */
import * as ClipperLib from "clipper-lib";
import { formatNumber, unitSuffix, type ScaleConfig, type ScaleUnit } from "./scale-config";
import { activeT } from "../../i18n/active";

export interface Pt {
  x: number;
  y: number;
}

type Ring = [number, number][];

/** A shape to measure: the zone shapes, painted areas included (polygons → [outer, ...holes]). */
export type AreaShape =
  | { kind: "rectangle"; x: number; y: number; width: number; height: number }
  | { kind: "circle"; x: number; y: number; radius: number }
  | { kind: "polygon"; points: Pt[] }
  | { kind: "area"; polygons: Ring[][] };

/** Shoelace area of a ring (open or closed), unsigned. */
function ringArea(ring: readonly Pt[]): number {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

function ringLength(ring: readonly Pt[], closed = true): number {
  let sum = 0;
  const n = closed ? ring.length : ring.length - 1;
  for (let i = 0; i < n; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    sum += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return sum;
}

const toPts = (ring: Ring): Pt[] => {
  const pts = ring.map(([x, y]) => ({ x, y }));
  // Stored rings repeat their first point at the end.
  const first = pts[0];
  const last = pts[pts.length - 1];
  return pts.length > 1 && first.x === last.x && first.y === last.y ? pts.slice(0, -1) : pts;
};

// Clipper needs integers: 1/100 px is far below anything visible.
const CLIP_SCALE = 100;

/**
 * A drawn polygon's area. One whose edges cross itself (a figure 8) is split
 * into its loops first, so each loop counts once instead of cancelling out.
 */
function polygonArea(points: readonly Pt[]): number {
  if (points.length < 3) return 0;
  const path = points.map((p) => ({ X: Math.round(p.x * CLIP_SCALE), Y: Math.round(p.y * CLIP_SCALE) }));
  const parts = ClipperLib.Clipper.SimplifyPolygon(path, ClipperLib.PolyFillType.pftNonZero);
  // Holes come back with the opposite orientation: a signed sum subtracts them.
  const signed = parts.reduce((sum, part) => sum + ClipperLib.Clipper.Area(part), 0);
  return Math.abs(signed) / (CLIP_SCALE * CLIP_SCALE);
}

/** Area in square frame pixels. */
export function shapeAreaPx(shape: AreaShape): number {
  switch (shape.kind) {
    case "rectangle":
      return shape.width * shape.height;
    case "circle":
      return Math.PI * shape.radius * shape.radius;
    case "polygon":
      return polygonArea(shape.points);
    case "area":
      // Painted areas are clean (built by polygon booleans): outer ring minus its holes.
      return shape.polygons.reduce((sum, [outer, ...holes]) => sum + (outer ? ringArea(toPts(outer)) : 0) - holes.reduce((h, ring) => h + ringArea(toPts(ring)), 0), 0);
  }
}

/** Perimeter in frame pixels (a painted area's holes count: they're borders too). */
export function shapePerimeterPx(shape: AreaShape): number {
  switch (shape.kind) {
    case "rectangle":
      return 2 * (shape.width + shape.height);
    case "circle":
      return 2 * Math.PI * shape.radius;
    case "polygon":
      return ringLength(shape.points);
    case "area":
      return shape.polygons.flat().reduce((sum, ring) => sum + ringLength(toPts(ring)), 0);
  }
}

/** A stored zone as a shape to measure, or null when its geometry is unreadable. */
export function zoneAreaShape(shapeType: string, geometry: string): AreaShape | null {
  try {
    const g = JSON.parse(geometry);
    if (shapeType === "rectangle" && [g.x, g.y, g.width, g.height].every(Number.isFinite)) return { kind: "rectangle", x: g.x, y: g.y, width: g.width, height: g.height };
    if (shapeType === "circle" && [g.x, g.y, g.radius].every(Number.isFinite)) return { kind: "circle", x: g.x, y: g.y, radius: g.radius };
    if (shapeType === "polygon" && Array.isArray(g.points)) return { kind: "polygon", points: g.points };
    if (shapeType === "area" && Array.isArray(g.polygons)) return { kind: "area", polygons: g.polygons };
  } catch {
    // unreadable: no area
  }
  return null;
}

// ---- Units ----

/** Meters in one unit of length ("leagues" as the usual 3 miles, like the travel tool). */
const UNIT_METERS: Record<Exclude<ScaleUnit, "custom">, number> = {
  km: 1000,
  m: 1,
  mi: 1609.344,
  ft: 0.3048,
  yd: 0.9144,
  leagues: 3 * 1609.344,
};

const SQUARE_LABELS: Record<Exclude<ScaleUnit, "custom" | "leagues">, string> = { km: "km²", m: "m²", mi: "mi²", ft: "ft²", yd: "yd²" };
/** A squared unit's label in the user's language ("km²", "sq leagues", "hectares"). */
const squareLabel = (key: Exclude<ScaleUnit, "custom"> | "hectares" | "acres") => {
  if (key === "leagues" || key === "hectares" || key === "acres") return activeT("maps")(`scale.area.${key}`);
  return SQUARE_LABELS[key];
};

/** Order of the readings after the map's own unit. */
const AREA_ORDER = ["km", "m", "hectares", "mi", "acres", "ft", "yd", "leagues"] as const;
const SQ_METERS_PER: Record<"hectares" | "acres", number> = { hectares: 10_000, acres: 4046.8564224 };

export interface AreaReading {
  key: string;
  /** "km²", "hectares", "sq leagues"… */
  unit: string;
  value: number;
}

/**
 * The area in every unit it converts to, the map's own scale unit first.
 * A custom unit (no known length) reads in that unit squared only. Empty
 * while the scale isn't calibrated.
 */
export function areaReadings(areaPx: number, config: Pick<ScaleConfig, "framePxPerUnit" | "unit" | "customLabel">): AreaReading[] {
  const ppu = config.framePxPerUnit;
  if (!ppu) return [];
  const inScaleUnit = areaPx / (ppu * ppu);
  if (config.unit === "custom") return [{ key: "custom", unit: `${unitSuffix(config)}²`, value: inScaleUnit }];
  const sqMeters = inScaleUnit * UNIT_METERS[config.unit] ** 2;
  const all: AreaReading[] = AREA_ORDER.map((key) =>
    key === "hectares" || key === "acres"
      ? { key, unit: squareLabel(key), value: sqMeters / SQ_METERS_PER[key] }
      : { key, unit: squareLabel(key), value: sqMeters / UNIT_METERS[key] ** 2 },
  );
  return [...all.filter((r) => r.key === config.unit), ...all.filter((r) => r.key !== config.unit)];
}

/** The units of each measurement system, in the order they lead the list. */
const SYSTEM_AREA_KEYS: Record<"metric" | "imperial", readonly string[]> = {
  metric: ["km", "m", "hectares"],
  imperial: ["mi", "acres", "ft", "yd"],
};

/**
 * The readings split for display: the user's measurement system first (in
 * its own order), every other unit behind "show more". A custom unit has
 * only its own reading, always shown.
 */
export function splitReadings(readings: AreaReading[], system: "metric" | "imperial"): { main: AreaReading[]; more: AreaReading[] } {
  const keys = SYSTEM_AREA_KEYS[system];
  const main = keys.flatMap((key) => readings.filter((r) => r.key === key));
  if (main.length === 0) return { main: readings, more: [] };
  return { main, more: readings.filter((r) => !keys.includes(r.key)) };
}

/** A length in the map's scale unit ("12.4 km"), or null while uncalibrated. */
export function formatLength(lengthPx: number, config: Pick<ScaleConfig, "framePxPerUnit" | "unit" | "customLabel">): string | null {
  const ppu = config.framePxPerUnit;
  if (!ppu) return null;
  return `${formatNumber(lengthPx / ppu)} ${unitSuffix(config)}`;
}

export const formatReading = (r: AreaReading) => `${formatNumber(r.value)} ${r.unit}`;

/**
 * The area in one unit ("1,240 km²"): the first of the user's measurement
 * system when given, else the map's own unit. Null while uncalibrated.
 */
export function formatArea(areaPx: number, config: Pick<ScaleConfig, "framePxPerUnit" | "unit" | "customLabel">, system?: "metric" | "imperial"): string | null {
  const readings = areaReadings(areaPx, config);
  const first = system ? splitReadings(readings, system).main[0] : readings[0];
  return first ? formatReading(first) : null;
}
