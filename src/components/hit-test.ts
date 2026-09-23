import type { MultiPolygon } from "./zone-paint";
import { lineBounds, textBounds, textBox, type Rect } from "./scene-bounds";
import type { SceneKind } from "./ScenePanel";

/**
 * Selection tool hit-testing (pure). Everything is in frame image pixels;
 * `pxPerImage` (screen pixels per image pixel) turns the screen-sized
 * tolerances into image pixels.
 */

type Pt = { x: number; y: number };
type PenPt = Pt & { cin?: Pt; cout?: Pt };

export interface HitScene {
  markers: { id: string; x: number; y: number }[];
  texts: { id: string; x: number; y: number; text: string; fontSize: number; letterSpacing: number; rotation: number }[];
  lines: { id: string; points: PenPt[]; width: number }[];
  /** In paint order: the last one is drawn on top. */
  zones: { id: string; bounds: Rect; polygons: MultiPolygon }[];
}

export interface Hit {
  kind: SceneKind;
  id: string;
  /** What the hover box outlines. */
  bounds: Rect;
}

/** Screen-pixel tolerances. */
export const MARKER_HIT_PX = 14;
export const LINE_HIT_PX = 6;
const CURVE_SAMPLES = 16;

function inRect(p: Pt, r: Rect, pad = 0): boolean {
  return p.x >= r.x - pad && p.x <= r.x + r.width + pad && p.y >= r.y - pad && p.y <= r.y + r.height + pad;
}

/** Inside its box once the point is rotated back about the text's center. */
export function hitText(t: HitScene["texts"][number], p: Pt): boolean {
  const { width, height } = textBox(t);
  const a = (-t.rotation * Math.PI) / 180;
  const dx = p.x - t.x;
  const dy = p.y - t.y;
  const lx = dx * Math.cos(a) - dy * Math.sin(a);
  const ly = dx * Math.sin(a) + dy * Math.cos(a);
  return Math.abs(lx) <= width / 2 && Math.abs(ly) <= height / 2;
}

function cubic(a: Pt, b: Pt, c: Pt, d: Pt, t: number): Pt {
  const u = 1 - t;
  return {
    x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
    y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
  };
}

/** The line as a polyline, pen curves sampled along their Bézier segments. */
export function flattenLine(points: PenPt[]): Pt[] {
  const out: Pt[] = points.length ? [points[0]] : [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const d = points[i];
    if (!a.cout && !d.cin) {
      out.push(d);
      continue;
    }
    for (let s = 1; s <= CURVE_SAMPLES; s++) out.push(cubic(a, a.cout ?? a, d.cin ?? d, d, s / CURVE_SAMPLES));
  }
  return out;
}

function segmentDistance(p: Pt, a: Pt, b: Pt): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const len2 = vx * vx + vy * vy;
  const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2)) : 0;
  return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy));
}

export function lineDistance(points: PenPt[], p: Pt): number {
  const flat = flattenLine(points);
  if (flat.length === 1) return Math.hypot(p.x - flat[0].x, p.y - flat[0].y);
  let best = Infinity;
  for (let i = 1; i < flat.length; i++) best = Math.min(best, segmentDistance(p, flat[i - 1], flat[i]));
  return best;
}

/** Even-odd over every ring, so holes don't count. */
export function inMultiPolygon(polygons: MultiPolygon, p: Pt): boolean {
  let inside = false;
  for (const polygon of polygons)
    for (const ring of polygon)
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        if (yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi) inside = !inside;
      }
  return inside;
}

/** The topmost item under `p`: markers, then texts, lines, zones (the map's stacking order). */
export function hitTest(scene: HitScene, p: Pt, pxPerImage: number): Hit | null {
  const scale = pxPerImage > 0 ? pxPerImage : 1;
  const markerR = MARKER_HIT_PX / scale;
  for (let i = scene.markers.length - 1; i >= 0; i--) {
    const m = scene.markers[i];
    if (Math.abs(p.x - m.x) <= markerR && Math.abs(p.y - m.y) <= markerR) {
      return { kind: "marker", id: m.id, bounds: { x: m.x - markerR, y: m.y - markerR, width: 2 * markerR, height: 2 * markerR } };
    }
  }
  for (let i = scene.texts.length - 1; i >= 0; i--) {
    const t = scene.texts[i];
    if (hitText(t, p)) return { kind: "text", id: t.id, bounds: textBounds(t) };
  }
  for (let i = scene.lines.length - 1; i >= 0; i--) {
    const l = scene.lines[i];
    const tolerance = Math.max(l.width / 2, LINE_HIT_PX / scale);
    const b = lineBounds(l.points);
    if (!b || !inRect(p, b, tolerance)) continue;
    if (lineDistance(l.points, p) <= tolerance) return { kind: "line", id: l.id, bounds: b };
  }
  for (let i = scene.zones.length - 1; i >= 0; i--) {
    const z = scene.zones[i];
    if (inRect(p, z.bounds) && inMultiPolygon(z.polygons, p)) return { kind: "zone", id: z.id, bounds: z.bounds };
  }
  return null;
}
