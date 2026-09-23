import * as ClipperLib from "clipper-lib";

export interface Pt {
  x: number;
  y: number;
}

type Pair = [number, number];
type Ring = Pair[];
type Polygon = Ring[];
/** Polygons → rings ([outer, ...holes]) → closed [x, y] pairs. */
export type MultiPolygon = Polygon[];

/** A painted zone: each polygon is [outer ring, ...holes], each ring closed [x, y] pairs. */
export interface AreaGeom {
  polygons: MultiPolygon;
}

type AnyGeom = { x: number; y: number; width: number; height: number } | { x: number; y: number; radius: number } | { points: Pt[] } | AreaGeom;

// Clipper works on integer coordinates — that's what makes its booleans
// robust where floating-point libraries fail on near-coincident edges (e.g.
// painting back over an erased area). 1/100 image px is far below anything
// visible.
const SCALE = 100;

function closeRing(pts: Pair[]): Ring {
  return [...pts, pts[0]];
}

function circleRing(c: Pt, r: number, segments: number): Ring {
  const pts: Pair[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push([c.x + r * Math.cos(a), c.y + r * Math.sin(a)]);
  }
  return closeRing(pts);
}

/** Any stored zone geometry as a MultiPolygon, so rectangles/circles/polygons can be painted onto. */
export function toMultiPolygon(geom: AnyGeom): MultiPolygon {
  if ("polygons" in geom) return geom.polygons;
  if ("width" in geom) {
    const { x, y, width, height } = geom;
    return [[closeRing([[x, y], [x + width, y], [x + width, y + height], [x, y + height]])]];
  }
  if ("radius" in geom) return [[circleRing(geom, geom.radius, 64)]];
  return [[closeRing(geom.points.map((p) => [p.x, p.y] as Pair))]];
}

// ---- MultiPolygon <-> Clipper conversion ----

function ringToPath(ring: Ring): ClipperLib.Path {
  // Stored rings repeat their first point at the end; Clipper paths are implicitly closed.
  return ring.slice(0, -1).map(([x, y]) => ({ X: Math.round(x * SCALE), Y: Math.round(y * SCALE) }));
}

function multiPolygonToPaths(mp: MultiPolygon): ClipperLib.Paths {
  return mp.flatMap((polygon) => polygon.map(ringToPath));
}

function pathToRing(path: ClipperLib.Path): Ring {
  return closeRing(path.map((p) => [p.X / SCALE, p.Y / SCALE] as Pair));
}

/** Outer contours become polygons with their holes; islands nested inside holes become polygons of their own. */
function polyTreeToMultiPolygon(tree: ClipperLib.PolyTree): MultiPolygon {
  const out: MultiPolygon = [];
  function visitOuter(node: ClipperLib.PolyNode) {
    const polygon: Polygon = [pathToRing(node.Contour())];
    for (const hole of node.Childs()) {
      polygon.push(pathToRing(hole.Contour()));
      for (const island of hole.Childs()) visitOuter(island);
    }
    out.push(polygon);
  }
  for (const node of tree.Childs()) visitOuter(node);
  return out;
}

function execute(
  clipType: ClipperLib.ClipType,
  subject: ClipperLib.Paths,
  clip: ClipperLib.Paths,
  subjectFill = ClipperLib.PolyFillType.pftEvenOdd
): ClipperLib.PolyTree {
  const c = new ClipperLib.Clipper();
  c.AddPaths(subject, ClipperLib.PolyType.ptSubject, true);
  if (clip.length > 0) c.AddPaths(clip, ClipperLib.PolyType.ptClip, true);
  const tree = new ClipperLib.PolyTree();
  c.Execute(clipType, tree, subjectFill, ClipperLib.PolyFillType.pftNonZero);
  return tree;
}

/** The area swept by a round brush along the drag path (a single click is one round dab). */
function strokePaths(points: Pt[], radius: number): ClipperLib.Paths {
  const path = points.map((p) => ({ X: Math.round(p.x * SCALE), Y: Math.round(p.y * SCALE) }));
  // ArcTolerance is the max distance between the true arc and its chords —
  // proportional to the radius so small and large brushes look equally round.
  const offset = new ClipperLib.ClipperOffset(2, Math.max(0.25, radius * 0.01) * SCALE);
  offset.AddPath(path, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etOpenRound);
  const solution: ClipperLib.Paths = [];
  offset.Execute(solution, radius * SCALE);
  return solution;
}

// ---- simplification ----

function perpendicularDistance(p: Pair, a: Pair, b: Pair): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  return Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / len;
}

/** Douglas–Peucker on an open polyline. */
function simplifyLine(pts: Pair[], tolerance: number): Pair[] {
  if (pts.length < 3) return pts;
  let maxDist = 0;
  let index = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpendicularDistance(pts[i], pts[0], pts[pts.length - 1]);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }
  if (maxDist <= tolerance) return [pts[0], pts[pts.length - 1]];
  const left = simplifyLine(pts.slice(0, index + 1), tolerance);
  const right = simplifyLine(pts.slice(index), tolerance);
  return [...left.slice(0, -1), ...right];
}

function simplifyRing(ring: Ring, tolerance: number): Ring | null {
  // Split the closed ring at its farthest point from the start so both
  // halves are open polylines with fixed endpoints.
  const open = ring.slice(0, -1);
  if (open.length < 3) return null;
  let far = 0;
  let farDist = 0;
  for (let i = 1; i < open.length; i++) {
    const d = Math.hypot(open[i][0] - open[0][0], open[i][1] - open[0][1]);
    if (d > farDist) {
      farDist = d;
      far = i;
    }
  }
  const first = simplifyLine(open.slice(0, far + 1), tolerance);
  const second = simplifyLine([...open.slice(far), open[0]], tolerance);
  const pts = [...first.slice(0, -1), ...second.slice(0, -1)];
  return pts.length < 3 ? null : closeRing(pts);
}

/**
 * Applies one brush stroke to `base` (null = a brand-new zone): unions for
 * the brush, subtracts for the eraser, clips to the image, and simplifies
 * away sub-pixel detail so repeated strokes don't grow the vertex count
 * without bound. Returns null when nothing is left.
 */
export function applyStroke(
  base: MultiPolygon | null,
  strokePoints: Pt[],
  radius: number,
  mode: "add" | "erase",
  image: { w: number; h: number }
): AreaGeom | null {
  if (mode === "erase" && !base) return null;
  const stroke = strokePaths(strokePoints, radius);
  const basePaths = base ? multiPolygonToPaths(base) : [];

  const combined = ClipperLib.Clipper.PolyTreeToPaths(
    mode === "add"
      ? execute(ClipperLib.ClipType.ctUnion, basePaths, stroke)
      : execute(ClipperLib.ClipType.ctDifference, basePaths, stroke)
  );
  const bounds = ringToPath(closeRing([[0, 0], [image.w, 0], [image.w, image.h], [0, image.h]]));
  const clipped = polyTreeToMultiPolygon(execute(ClipperLib.ClipType.ctIntersection, combined, [bounds], ClipperLib.PolyFillType.pftNonZero));

  // Drop slivers and specks the size of a few tolerance squares, then let
  // Clipper re-normalize — simplification can nudge rings into touching.
  const tolerance = Math.max(0.5, radius * 0.02);
  const minArea = tolerance * tolerance * 4;
  const simplified: ClipperLib.Paths = [];
  for (const polygon of clipped) {
    const outer = simplifyRing(polygon[0], tolerance);
    if (!outer) continue;
    const outerPath = ringToPath(outer);
    if (Math.abs(ClipperLib.Clipper.Area(outerPath)) / (SCALE * SCALE) < minArea) continue;
    simplified.push(outerPath);
    for (const hole of polygon.slice(1)) {
      const h = simplifyRing(hole, tolerance);
      if (!h) continue;
      const holePath = ringToPath(h);
      if (Math.abs(ClipperLib.Clipper.Area(holePath)) / (SCALE * SCALE) >= minArea) simplified.push(holePath);
    }
  }
  if (simplified.length === 0) return null;
  const normalized = polyTreeToMultiPolygon(execute(ClipperLib.ClipType.ctUnion, simplified, []));
  return normalized.length > 0 ? { polygons: normalized } : null;
}

/** SVG path data for a MultiPolygon; render with fill-rule="evenodd" so holes stay holes. */
export function multiPolygonPath(polygons: MultiPolygon): string {
  let d = "";
  for (const polygon of polygons) {
    for (const ring of polygon) {
      d += `M${ring[0][0]} ${ring[0][1]}`;
      for (let i = 1; i < ring.length - 1; i++) d += `L${ring[i][0]} ${ring[i][1]}`;
      d += "Z";
    }
  }
  return d;
}

export function translateArea(geom: AreaGeom, dx: number, dy: number, size: { w: number; h: number }): AreaGeom {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const polygon of geom.polygons)
    for (const ring of polygon)
      for (const [x, y] of ring) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
  const cdx = Math.min(size.w - maxX, Math.max(-minX, dx));
  const cdy = Math.min(size.h - maxY, Math.max(-minY, dy));
  return { polygons: geom.polygons.map((polygon) => polygon.map((ring) => ring.map(([x, y]) => [x + cdx, y + cdy] as Pair))) };
}
