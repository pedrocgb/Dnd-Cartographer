import { normalizeColor, DEFAULT_COLOR } from "../markers/icon-registry";

export const ZONE_SHAPES = ["rectangle", "circle", "polygon"] as const;
export type ZoneShape = (typeof ZONE_SHAPES)[number];
const ZONE_SHAPE_SET = new Set<string>(ZONE_SHAPES);
export function isValidZoneShape(key: string): key is ZoneShape {
  return ZONE_SHAPE_SET.has(key);
}

export const DEFAULT_FILL_OPACITY = 0.25;
export const DEFAULT_STROKE_OPACITY = 1;
// Expressed as a fraction of image width, same convention as mapGrids.lineWidth —
// keeps the outline's visual proportion consistent regardless of the image's
// actual pixel size, at the cost of not being an exact CSS-pixel value.
export const DEFAULT_STROKE_WIDTH = 0.15;

export function clampOpacity(n: number): number {
  return Math.min(1, Math.max(0, n));
}

export function clampStrokeWidth(n: number): number {
  return Math.min(5, Math.max(0, n));
}

const EPS = 1e-6;

export interface RectGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CircleGeometry {
  x: number;
  y: number;
  radius: number;
}

export interface PolygonPoint {
  x: number;
  y: number;
}

export interface PolygonGeometry {
  points: PolygonPoint[];
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

export function validateRectGeometry(g: unknown, imageWidth: number, imageHeight: number): RectGeometry | null {
  if (!g || typeof g !== "object") return null;
  const { x, y, width, height } = g as Record<string, unknown>;
  if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(width) || !isFiniteNumber(height)) return null;
  if (width <= EPS || height <= EPS) return null;
  if (x < -EPS || y < -EPS || x + width > imageWidth + EPS || y + height > imageHeight + EPS) return null;
  return { x, y, width, height };
}

export function validateCircleGeometry(g: unknown, imageWidth: number, imageHeight: number): CircleGeometry | null {
  if (!g || typeof g !== "object") return null;
  const { x, y, radius } = g as Record<string, unknown>;
  if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(radius)) return null;
  if (radius <= EPS) return null;
  if (x - radius < -EPS || y - radius < -EPS || x + radius > imageWidth + EPS || y + radius > imageHeight + EPS) return null;
  return { x, y, radius };
}

function onSegment(p: PolygonPoint, q: PolygonPoint, r: PolygonPoint): boolean {
  return (
    Math.min(p.x, r.x) - EPS <= q.x &&
    q.x <= Math.max(p.x, r.x) + EPS &&
    Math.min(p.y, r.y) - EPS <= q.y &&
    q.y <= Math.max(p.y, r.y) + EPS
  );
}

function orient(p: PolygonPoint, q: PolygonPoint, r: PolygonPoint): 0 | 1 | 2 {
  const v = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
  if (Math.abs(v) < EPS) return 0;
  return v > 0 ? 1 : 2;
}

/** Standard orientation-based segment intersection test, including collinear overlap. */
function segmentsIntersect(p1: PolygonPoint, p2: PolygonPoint, p3: PolygonPoint, p4: PolygonPoint): boolean {
  const o1 = orient(p1, p2, p3);
  const o2 = orient(p1, p2, p4);
  const o3 = orient(p3, p4, p1);
  const o4 = orient(p3, p4, p2);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(p1, p3, p2)) return true;
  if (o2 === 0 && onSegment(p1, p4, p2)) return true;
  if (o3 === 0 && onSegment(p3, p1, p4)) return true;
  if (o4 === 0 && onSegment(p3, p2, p4)) return true;
  return false;
}

/**
 * Validates a simple (non-self-intersecting), positive-area polygon ring.
 * Concave polygons are allowed; bow-ties, zero-area, duplicate nonadjacent
 * vertices, and overlapping edges are rejected.
 */
export function validatePolygonGeometry(g: unknown, imageWidth: number, imageHeight: number): PolygonGeometry | null {
  if (!g || typeof g !== "object") return null;
  const points = (g as Record<string, unknown>).points;
  if (!Array.isArray(points) || points.length < 3) return null;

  const pts: PolygonPoint[] = [];
  for (const p of points) {
    if (!p || typeof p !== "object") return null;
    const { x, y } = p as Record<string, unknown>;
    if (!isFiniteNumber(x) || !isFiniteNumber(y)) return null;
    if (x < -EPS || y < -EPS || x > imageWidth + EPS || y > imageHeight + EPS) return null;
    pts.push({ x, y });
  }

  const n = pts.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y) < 1e-3) return null;
    }
  }

  let area = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    area += a.x * b.y - b.x * a.y;
  }
  area = Math.abs(area) / 2;
  if (area < 1e-3) return null;

  for (let i = 0; i < n; i++) {
    const a1 = pts[i];
    const a2 = pts[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      const b1 = pts[j];
      const b2 = pts[(j + 1) % n];
      const shareEndpoint = (i + 1) % n === j || (j + 1) % n === i;
      if (shareEndpoint) continue;
      if (segmentsIntersect(a1, a2, b1, b2)) return null;
    }
  }

  return { points: pts };
}

function hslToHex(h: number, s: number, l: number): string {
  const sFrac = s / 100;
  const lFrac = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sFrac * Math.min(lFrac, 1 - lFrac);
  const f = (n: number) => lFrac - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x: number) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`.toUpperCase();
}

/** A fresh random hue at fixed, readable saturation/lightness — sampled once per new zone. */
export function randomZoneColor(): string {
  const hue = Math.floor(Math.random() * 360);
  return hslToHex(hue, 70, 55);
}

export { normalizeColor, DEFAULT_COLOR };
