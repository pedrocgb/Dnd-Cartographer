import { parseLayerIds } from "../layers/layer-ids";
import { normalizeColor } from "../markers/icon-registry";

export const LINE_KINDS = ["free", "pen"] as const;
export type LineKind = (typeof LINE_KINDS)[number];
export const LINE_STYLES = ["solid", "dot", "dashed"] as const;
export type LineStyleKind = (typeof LINE_STYLES)[number];
export const LINE_CAPS = ["round", "square"] as const;
export type LineCap = (typeof LINE_CAPS)[number];

export interface LinePt {
  x: number;
  y: number;
}

/** A pen point; `cin`/`cout` are absolute Bézier handle positions (absent = sharp corner). */
export interface PenPt extends LinePt {
  cin?: LinePt;
  cout?: LinePt;
}

export const MAX_LINE_POINTS = 5000;

/** Everything about a line except its geometry and layer. */
export interface LineStyle {
  color: string;
  width: number; // frame pixels
  style: LineStyleKind;
  dashLength: number; // × width
  gapLength: number; // × width
  cap: LineCap;
  opacity: number; // 0..1
  shadowEnabled: boolean;
  shadowColor: string;
  shadowOpacity: number; // 0..1
  shadowBlur: number; // × width
  shadowDistance: number; // × width
  shadowAngle: number; // degrees, world direction the shadow falls towards
}

export const LINE_LIMITS = {
  dashLength: [0.5, 20],
  gapLength: [0.2, 20],
  shadowBlur: [0, 5],
  shadowDistance: [0, 5],
} as const;

export function defaultLineStyle(frameWidth: number, frameHeight: number): LineStyle {
  return {
    color: "#E11D48",
    width: Math.max(1, Math.round(Math.max(frameWidth, frameHeight) / 800)),
    style: "solid",
    dashLength: 3,
    gapLength: 2,
    cap: "round",
    opacity: 1,
    shadowEnabled: false,
    shadowColor: "#000000",
    shadowOpacity: 0.5,
    shadowBlur: 0.5,
    shadowDistance: 0.5,
    shadowAngle: 45,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function normalizeAngle(deg: number): number {
  const a = ((deg % 360) + 360) % 360;
  return a > 180 ? a - 360 : a;
}

function oneOf<T extends string>(list: readonly T[], v: unknown): v is T {
  return typeof v === "string" && (list as readonly string[]).includes(v);
}

/** Validates and clamps the style fields present in `body`; invalid/unknown keys are dropped. */
export function sanitizeLinePatch(body: Record<string, unknown>, frame: { width: number; height: number }): Partial<LineStyle> {
  const out: Partial<LineStyle> = {};
  if (typeof body.color === "string") out.color = normalizeColor(body.color, "#E11D48");
  const width = num(body.width);
  if (width !== null) out.width = clamp(width, 0.5, Math.max(frame.width, frame.height) / 10);
  if (oneOf(LINE_STYLES, body.style)) out.style = body.style;
  const dash = num(body.dashLength);
  if (dash !== null) out.dashLength = clamp(dash, ...LINE_LIMITS.dashLength);
  const gap = num(body.gapLength);
  if (gap !== null) out.gapLength = clamp(gap, ...LINE_LIMITS.gapLength);
  if (oneOf(LINE_CAPS, body.cap)) out.cap = body.cap;
  const opacity = num(body.opacity);
  if (opacity !== null) out.opacity = clamp(opacity, 0, 1);
  if (typeof body.shadowEnabled === "boolean") out.shadowEnabled = body.shadowEnabled;
  if (typeof body.shadowColor === "string") out.shadowColor = normalizeColor(body.shadowColor, "#000000");
  const so = num(body.shadowOpacity);
  if (so !== null) out.shadowOpacity = clamp(so, 0, 1);
  const blur = num(body.shadowBlur);
  if (blur !== null) out.shadowBlur = clamp(blur, ...LINE_LIMITS.shadowBlur);
  const dist = num(body.shadowDistance);
  if (dist !== null) out.shadowDistance = clamp(dist, ...LINE_LIMITS.shadowDistance);
  const angle = num(body.shadowAngle);
  if (angle !== null) out.shadowAngle = normalizeAngle(angle);
  return out;
}

function clampPt(raw: unknown, frame: { width: number; height: number }): LinePt | null {
  if (!raw || typeof raw !== "object") return null;
  const x = num((raw as LinePt).x);
  const y = num((raw as LinePt).y);
  if (x === null || y === null) return null;
  return { x: clamp(x, 0, frame.width), y: clamp(y, 0, frame.height) };
}

/**
 * Validates a point list (2..MAX_LINE_POINTS), clamping every point into the
 * frame. Pen points keep their optional handles; free points drop anything
 * but x/y. Returns null when the list is unusable.
 */
export function sanitizePoints(kind: LineKind, raw: unknown, frame: { width: number; height: number }): PenPt[] | null {
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > MAX_LINE_POINTS) return null;
  const out: PenPt[] = [];
  for (const item of raw) {
    const p = clampPt(item, frame);
    if (!p) return null;
    if (kind === "pen") {
      // Handles may sit outside the frame (curves bulge); only require finite values.
      const cin = (item as PenPt).cin;
      const cout = (item as PenPt).cout;
      const pt: PenPt = { ...p };
      if (cin && num(cin.x) !== null && num(cin.y) !== null) pt.cin = { x: cin.x, y: cin.y };
      if (cout && num(cout.x) !== null && num(cout.y) !== null) pt.cout = { x: cout.x, y: cout.y };
      out.push(pt);
    } else {
      out.push(p);
    }
  }
  return out;
}

/**
 * Moves every point (and handle) by dx/dy, clamping the move so the line's
 * points stay inside the frame.
 */
export function translatePoints(points: PenPt[], dx: number, dy: number, frame: { width: number; height: number }): PenPt[] {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const cdx = clamp(dx, -Math.min(...xs), frame.width - Math.max(...xs));
  const cdy = clamp(dy, -Math.min(...ys), frame.height - Math.max(...ys));
  const move = (p: LinePt) => ({ x: p.x + cdx, y: p.y + cdy });
  return points.map((p) => ({
    ...move(p),
    ...(p.cin ? { cin: move(p.cin) } : {}),
    ...(p.cout ? { cout: move(p.cout) } : {}),
  }));
}

/** DB row → client shape (points parsed; a corrupt value becomes an empty list). */
export function toClientLine<T extends { points: string; extraLayerIds?: string }>(
  row: T
): Omit<T, "points" | "extraLayerIds"> & { points: PenPt[]; extraLayerIds: string[] } {
  let points: PenPt[] = [];
  try {
    const parsed = JSON.parse(row.points);
    if (Array.isArray(parsed)) points = parsed;
  } catch {
    // keep []
  }
  return { ...row, points, extraLayerIds: parseLayerIds(row.extraLayerIds) };
}
