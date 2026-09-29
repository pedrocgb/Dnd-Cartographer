import { describe, expect, it } from "vitest";
import { dashArray, freePath, penPath, pointsBounds, polylineLength, simplify, snapToAngle } from "../src/components/line-geometry";
import { pullString, smoothingTolerance, stringLength } from "../src/components/line-geometry";

describe("penPath", () => {
  it("uses straight segments between corner points", () => {
    expect(penPath([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }])).toBe("M 0 0 L 10 0 L 10 10");
  });

  it("uses a cubic when either side has a handle", () => {
    const d = penPath([{ x: 0, y: 0, cout: { x: 5, y: -5 } }, { x: 10, y: 0 }]);
    expect(d).toBe("M 0 0 C 5 -5 10 0 10 0");
  });
});

describe("freePath", () => {
  it("is a line for two points and cubics through every point otherwise", () => {
    expect(freePath([{ x: 0, y: 0 }, { x: 3, y: 4 }])).toBe("M 0 0 L 3 4");
    const d = freePath([{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 0 }]);
    expect(d.match(/C/g)).toHaveLength(2);
    expect(d.endsWith("20 0")).toBe(true);
  });
});

describe("simplify", () => {
  it("drops collinear noise but keeps corners", () => {
    const pts = [{ x: 0, y: 0 }, { x: 5, y: 0.1 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
    expect(simplify(pts, 0.5)).toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);
  });
});

describe("dashArray", () => {
  it("solid has none; dashes/gaps compensate for the cap extension", () => {
    expect(dashArray("solid", 4, 3, 2)).toBeUndefined();
    expect(dashArray("dashed", 4, 3, 2)).toBe("8 12"); // visible dash 12 (8 + 4 of caps), visible gap 8
    expect(dashArray("dot", 4, 3, 2)).toBe("0.001 12");
  });
});

describe("bounds and length", () => {
  it("includes pen handles in the bounds", () => {
    expect(pointsBounds([{ x: 0, y: 0, cout: { x: 5, y: -5 } }, { x: 10, y: 2 }])).toEqual({ x: 0, y: -5, width: 10, height: 7 });
    expect(polylineLength([{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 3, y: 4 }])).toBe(5);
  });
});

describe("snapToAngle", () => {
  it("snaps to horizontal, vertical or 45° keeping the distance", () => {
    const o = { x: 0, y: 0 };
    const h = snapToAngle(o, { x: 10, y: 1 });
    expect(h.x).toBeCloseTo(Math.hypot(10, 1));
    expect(h.y).toBeCloseTo(0);
    const v = snapToAngle(o, { x: -1, y: 10 });
    expect(v.x).toBeCloseTo(0);
    const d = snapToAngle(o, { x: 10, y: 8 });
    expect(d.x).toBeCloseTo(d.y);
  });
});

describe("free-draw smoothing", () => {
  it("keeps the pen still while the cursor stays within the string", () => {
    expect(pullString({ x: 0, y: 0 }, { x: 3, y: 4 }, 10)).toBeNull();
  });

  it("drags the pen behind the cursor at the string's length", () => {
    expect(pullString({ x: 0, y: 0 }, { x: 30, y: 40 }, 10)).toEqual({ x: 24, y: 32 });
  });

  it("follows the cursor exactly with no string (smoothing off)", () => {
    expect(pullString({ x: 0, y: 0 }, { x: 5, y: 0 }, stringLength(0))).toEqual({ x: 5, y: 0 });
    expect(pullString({ x: 5, y: 0 }, { x: 5, y: 0 }, 0)).toBeNull();
  });

  it("scales string and release tolerance with the setting, clamped", () => {
    expect(stringLength(0)).toBe(0);
    expect(stringLength(200)).toBe(stringLength(100));
    expect(smoothingTolerance(0)).toBeCloseTo(0.75);
    expect(smoothingTolerance(100)).toBeCloseTo(3);
  });
});
