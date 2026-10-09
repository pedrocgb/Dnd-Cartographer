import { describe, expect, it } from "vitest";
import { arcPaths, curveFromDrag, isCurved, lineBaselines, rotationFromDrag, scaleFromDrag, shadowOffset } from "../src/components/text-geometry";

function parseArc(d: string) {
  const n = d.replace(/[MA]/g, " ").trim().split(/\s+/).map(Number);
  return { x0: n[0], y0: n[1], r: n[2], sweep: n[6], x1: n[7], y1: n[8] };
}

describe("lineBaselines", () => {
  it("centers the block of lines on 0", () => {
    const [a, b] = lineBaselines(2, 10);
    expect(a + b).toBeCloseTo(2 * 0.35 * 10);
    expect(b - a).toBeCloseTo(12);
  });
});

describe("arcPaths", () => {
  it("a half-circle arch fits the line width on its arc length", () => {
    const [d] = arcPaths(100, 100, [0]);
    const arc = parseArc(d);
    expect(arc.r * Math.PI).toBeCloseTo(100); // arc length = width
    expect(arc.sweep).toBe(1); // arch (∩)
    expect(arc.x0).toBeCloseTo(-arc.x1);
  });

  it("negative curve bends into a bowl with concentric, larger lower lines", () => {
    const [top, bottom] = arcPaths(-50, 100, [0, 12]);
    expect(parseArc(top).sweep).toBe(0);
    expect(parseArc(bottom).r).toBeGreaterThan(parseArc(top).r);
  });

  it("tiny curves are drawn straight", () => {
    expect(isCurved(0.2)).toBe(false);
    expect(isCurved(-3)).toBe(true);
  });
});

describe("gestures", () => {
  it("scales font size by distance ratio from the center, clamped", () => {
    const c = { x: 0, y: 0 };
    expect(scaleFromDrag(c, { x: 10, y: 0 }, { x: 20, y: 0 }, 30, 1, 1000)).toBe(60);
    expect(scaleFromDrag(c, { x: 10, y: 0 }, { x: 1000, y: 0 }, 30, 1, 500)).toBe(500);
  });

  it("rotation is 0 with the pointer straight above, snaps with shift", () => {
    const c = { x: 0, y: 0 };
    expect(rotationFromDrag(c, { x: 0, y: -10 }, false)).toBeCloseTo(0);
    expect(rotationFromDrag(c, { x: 10, y: 0 }, false)).toBeCloseTo(90);
    expect(rotationFromDrag(c, { x: 10, y: -9 }, true)).toBe(45);
  });

  it("shadow keeps its world direction regardless of text rotation", () => {
    const o = shadowOffset(0, 0.1, 100, 90); // world: right; text rotated 90°
    expect(o.x).toBeCloseTo(0);
    expect(o.y).toBeCloseTo(-10);
  });
});

describe("curveFromDrag", () => {
  const start = { x: 0, y: 0 };
  it("arches when dragged up and bows when dragged down", () => {
    expect(curveFromDrag(start, { x: 0, y: -20 }, 0, 10, 0)).toBe(50);
    expect(curveFromDrag(start, { x: 0, y: 20 }, 0, 10, 0)).toBe(-50);
  });
  it("follows the text's own up when rotated", () => {
    // Rotated 90° (clockwise on screen): the text's up points along +x on the map.
    expect(curveFromDrag(start, { x: 20, y: 0 }, 0, 10, 90)).toBe(50);
    expect(curveFromDrag(start, { x: 0, y: -20 }, 0, 10, 90)).toBe(0);
  });
  it("clamps and snaps back to straight near zero", () => {
    expect(curveFromDrag(start, { x: 0, y: -1000 }, 0, 10, 0)).toBe(100);
    expect(curveFromDrag(start, { x: 0, y: 1 }, 2, 10, 0)).toBe(0);
  });
});
