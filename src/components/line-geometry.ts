import type { LinePt, LineStyleKind, PenPt } from "@/server/lines/line-config";

const f = (n: number) => Math.round(n * 100) / 100;
const pt = (p: LinePt) => `${f(p.x)} ${f(p.y)}`;

/**
 * SVG path for pen points: a segment is straight when neither end has a
 * handle on that side, otherwise a cubic Bézier using the previous point's
 * `cout` and the next point's `cin` (a missing handle = the point itself).
 */
export function penPath(points: PenPt[]): string {
  if (points.length === 0) return "";
  let d = `M ${pt(points[0])}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    if (!prev.cout && !cur.cin) d += ` L ${pt(cur)}`;
    else d += ` C ${pt(prev.cout ?? prev)} ${pt(cur.cin ?? cur)} ${pt(cur)}`;
  }
  return d;
}

/** Smooth path through free-drawn points (uniform Catmull-Rom as cubic Béziers). */
export function freePath(points: LinePt[]): string {
  if (points.length === 0) return "";
  let d = `M ${pt(points[0])}`;
  if (points.length === 2) return `${d} L ${pt(points[1])}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C ${pt(c1)} ${pt(c2)} ${pt(p2)}`;
  }
  return d;
}

function distToSegment(p: LinePt, a: LinePt, b: LinePt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Ramer–Douglas–Peucker: drops points closer than `tolerance` to the simplified line. */
export function simplify(points: LinePt[], tolerance: number): LinePt[] {
  if (points.length <= 2) return points;
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop()!;
    let maxDist = 0;
    let index = -1;
    for (let i = start + 1; i < end; i++) {
      const d = distToSegment(points[i], points[start], points[end]);
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }
    if (index !== -1 && maxDist > tolerance) {
      keep[index] = true;
      stack.push([start, index], [index, end]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/**
 * stroke-dasharray for a style. Dash and gap are multiples of the line width,
 * measured as they look: round/square caps add half a width to both ends of
 * every dash (both supported caps extend them equally), so that width is
 * taken off the dash and added to the gap. Dots are near-zero dashes, so the
 * cap draws them (round = dots, square = squares).
 */
export function dashArray(style: LineStyleKind, width: number, dash: number, gap: number): string | undefined {
  if (style === "solid") return undefined;
  const visibleGap = gap * width + width;
  // Not rounded: the dot's tiny dash must stay non-zero for every browser to draw its cap.
  const visibleDash = style === "dot" ? 0.001 : Math.max(0.001, f(dash * width - width));
  return `${visibleDash} ${f(visibleGap)}`;
}

export function pointsBounds(points: PenPt[]): { x: number; y: number; width: number; height: number } | null {
  if (points.length === 0) return null;
  const all = points.flatMap((p) => [p, ...(p.cin ? [p.cin] : []), ...(p.cout ? [p.cout] : [])]);
  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/** Total length of the straight segments between points (to reject zero-length strokes). */
export function polylineLength(points: LinePt[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  return len;
}

/**
 * `to`, moved onto the nearest multiple of `stepDeg` around `from` (keeping
 * its distance) — Shift-constrained pen segments: horizontal, vertical or diagonal.
 */
export function snapToAngle(from: LinePt, to: LinePt, stepDeg = 45): LinePt {
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  if (dist === 0) return { ...to };
  const step = (stepDeg * Math.PI) / 180;
  const angle = Math.round(Math.atan2(to.y - from.y, to.x - from.x) / step) * step;
  return { x: from.x + Math.cos(angle) * dist, y: from.y + Math.sin(angle) * dist };
}
