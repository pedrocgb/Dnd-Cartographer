import type { Rect } from "./scene-bounds";

/**
 * Placement of a pasted item: the shift that puts its bounds' center under
 * the pointer, clamped so the item stays inside the map frame (an item larger
 * than the frame is pinned to its top-left).
 */
export function centerAt(b: Rect, point: { x: number; y: number }, frame: { width: number; height: number }): { dx: number; dy: number } {
  const clampShift = (want: number, start: number, size: number, limit: number) => Math.max(-start, Math.min(limit - (start + size), want));
  return {
    dx: clampShift(point.x - (b.x + b.width / 2), b.x, b.width, frame.width),
    dy: clampShift(point.y - (b.y + b.height / 2), b.y, b.height, frame.height),
  };
}

type Pair = [number, number];

/** A zone's stored geometry (rectangle, circle, polygon or painted area) moved by dx/dy. */
export function translateZoneGeometry(geometry: unknown, dx: number, dy: number): unknown {
  if (!geometry || typeof geometry !== "object") return geometry;
  const g = geometry as Record<string, unknown>;
  if (Array.isArray(g.points)) {
    return { ...g, points: (g.points as { x: number; y: number }[]).map((p) => ({ x: p.x + dx, y: p.y + dy })) };
  }
  if (Array.isArray(g.polygons)) {
    return { ...g, polygons: (g.polygons as Pair[][][]).map((polygon) => polygon.map((ring) => ring.map(([x, y]) => [x + dx, y + dy]))) };
  }
  if (typeof g.x === "number" && typeof g.y === "number") return { ...g, x: g.x + dx, y: g.y + dy };
  return geometry;
}
