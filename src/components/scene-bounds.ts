/**
 * Bounds (in frame pixels) of the things listed in the Scene panel, and the
 * padded rectangle the viewer zooms to when one is picked.
 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type Pt = { x: number; y: number };

function boundsOf(points: Pt[]): Rect | null {
  if (points.length === 0) return null;
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const p of points) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/** A zone's stored geometry: rectangle, circle, polygon or painted area (MultiPolygon). */
export function zoneBounds(geometry: unknown): Rect | null {
  if (!geometry || typeof geometry !== "object") return null;
  const g = geometry as Record<string, unknown>;
  if (typeof g.width === "number" && typeof g.height === "number" && typeof g.x === "number" && typeof g.y === "number") {
    return { x: g.x, y: g.y, width: g.width, height: g.height };
  }
  if (typeof g.radius === "number" && typeof g.x === "number" && typeof g.y === "number") {
    return { x: g.x - g.radius, y: g.y - g.radius, width: g.radius * 2, height: g.radius * 2 };
  }
  if (Array.isArray(g.points)) return boundsOf(g.points as Pt[]);
  if (Array.isArray(g.polygons)) {
    const pts: Pt[] = [];
    for (const polygon of g.polygons as [number, number][][][]) {
      // The outer ring bounds the polygon; holes are inside it.
      for (const [x, y] of polygon[0] ?? []) pts.push({ x, y });
    }
    return boundsOf(pts);
  }
  return null;
}

/** A line's points, including pen handles (curves bulge towards them). */
export function lineBounds(points: (Pt & { cin?: Pt; cout?: Pt })[]): Rect | null {
  return boundsOf(points.flatMap((p) => [p, ...(p.cin ? [p.cin] : []), ...(p.cout ? [p.cout] : [])]));
}

/** A text's approximate unrotated size (see textBounds). */
export function textBox(t: { text: string; fontSize: number; letterSpacing: number }): { width: number; height: number } {
  const lines = t.text.split("\n");
  const longest = Math.max(1, ...lines.map((l) => l.length));
  return { width: longest * t.fontSize * (0.6 + t.letterSpacing), height: lines.length * t.fontSize * 1.2 };
}

/**
 * A text's approximate box: its longest line at ~0.6em per glyph plus letter
 * spacing, one line-height per line, rotated about its center.
 */
export function textBounds(t: { x: number; y: number; text: string; fontSize: number; letterSpacing: number; rotation: number }): Rect {
  const { width: w, height: h } = textBox(t);
  const a = (t.rotation * Math.PI) / 180;
  const c = Math.abs(Math.cos(a));
  const s = Math.abs(Math.sin(a));
  const bw = w * c + h * s;
  const bh = w * s + h * c;
  return { x: t.x - bw / 2, y: t.y - bh / 2, width: bw, height: bh };
}

/**
 * The rectangle to fit the view to so `b` is emphasized: centered on it,
 * grown so the feature fills about `fill` of the view, never smaller than
 * `minFraction` of the frame (a marker is a point), clamped to sane sizes.
 */
export function focusRect(b: Rect, frame: { width: number; height: number }, fill = 0.45, minFraction = 1 / 12): Rect {
  const minSize = Math.max(frame.width, frame.height) * minFraction;
  const width = Math.max(b.width / fill, minSize);
  const height = Math.max(b.height / fill, minSize);
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  return { x: cx - width / 2, y: cy - height / 2, width, height };
}
