import type { Pt } from "./osd-coords";

/** Map labels use a fixed 1.2 line height, in font-size units. */
export const LINE_HEIGHT = 1.2;

function normalizeDeg(deg: number): number {
  const a = ((deg % 360) + 360) % 360;
  return a > 180 ? a - 360 : a;
}

/**
 * Baseline y of each line (local, unrotated coords centered on the text),
 * so the block of `lineCount` lines is vertically centered on 0.
 * 0.35em lowers each baseline so a line's x-height sits on its slot center.
 */
export function lineBaselines(lineCount: number, fontSize: number): number[] {
  const lh = LINE_HEIGHT * fontSize;
  return Array.from({ length: lineCount }, (_, i) => (i - (lineCount - 1) / 2) * lh + 0.35 * fontSize);
}

/** Below this |curve| the text is drawn straight. */
const MIN_CURVE = 0.5;

export function isCurved(curve: number): boolean {
  return Math.abs(curve) >= MIN_CURVE;
}

/**
 * SVG arc paths (one per line, left to right) for curved text. `curve` in
 * -100..100 sets the arc's angular span (100 = half circle); the radius comes
 * from the widest line so it fits its arc exactly. Positive = arch (∩, center
 * below), negative = bowl (∪, center above); lines are concentric.
 */
export function arcPaths(curve: number, maxLineWidth: number, baselines: number[]): string[] {
  const theta = (Math.min(100, Math.abs(curve)) / 100) * Math.PI;
  const r0 = Math.max(maxLineWidth, 1) / theta;
  const arch = curve > 0;
  const y0 = baselines[0] ?? 0;
  const cy = arch ? y0 + r0 : y0 - r0;
  const s = Math.sin(theta / 2);
  const c = Math.cos(theta / 2);
  return baselines.map((y) => {
    // Keep a sliver of radius for lines that would cross the arc's center.
    const r = Math.max(arch ? cy - y : y - cy, 1);
    const yEnd = arch ? cy - r * c : cy + r * c;
    const sweep = arch ? 1 : 0;
    return `M ${-r * s} ${yEnd} A ${r} ${r} 0 0 ${sweep} ${r * s} ${yEnd}`;
  });
}

/** Font size after dragging a corner handle from `start` to `current` (uniform scale about `center`). */
export function scaleFromDrag(center: Pt, start: Pt, current: Pt, startFontSize: number, min: number, max: number): number {
  const d0 = Math.hypot(start.x - center.x, start.y - center.y);
  const d1 = Math.hypot(current.x - center.x, current.y - center.y);
  if (d0 < 1e-6) return startFontSize;
  return Math.min(max, Math.max(min, startFontSize * (d1 / d0)));
}

/**
 * Rotation (degrees) while dragging the rotate handle, which sits straight
 * above the text: pointer straight above the center = 0°. Shift snaps to 15°.
 */
export function rotationFromDrag(center: Pt, pointer: Pt, snap: boolean): number {
  const deg = (Math.atan2(pointer.y - center.y, pointer.x - center.x) * 180) / Math.PI + 90;
  return normalizeDeg(snap ? Math.round(deg / 15) * 15 : deg);
}

/**
 * Drop-shadow offset in the text's local (rotated) coordinates, so the shadow
 * keeps falling towards `angleDeg` in the world whatever the text rotation.
 */
export function shadowOffset(angleDeg: number, distanceEm: number, fontSize: number, rotationDeg: number): Pt {
  const a = ((angleDeg - rotationDeg) * Math.PI) / 180;
  const d = distanceEm * fontSize;
  return { x: Math.cos(a) * d, y: Math.sin(a) * d };
}
