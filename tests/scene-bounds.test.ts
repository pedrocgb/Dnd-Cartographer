import { describe, expect, it } from "vitest";
import { focusRect, lineBounds, textBounds, zoneBounds } from "../src/components/scene-bounds";

describe("zoneBounds", () => {
  it("handles every zone shape", () => {
    expect(zoneBounds({ x: 1, y: 2, width: 3, height: 4 })).toEqual({ x: 1, y: 2, width: 3, height: 4 });
    expect(zoneBounds({ x: 10, y: 10, radius: 5 })).toEqual({ x: 5, y: 5, width: 10, height: 10 });
    expect(zoneBounds({ points: [{ x: 0, y: 0 }, { x: 4, y: 1 }, { x: 2, y: 6 }] })).toEqual({ x: 0, y: 0, width: 4, height: 6 });
    const area = {
      polygons: [
        [[[0, 0], [2, 0], [2, 2], [0, 0]]],
        [[[10, 10], [12, 10], [12, 13], [10, 10]]],
      ],
    };
    expect(zoneBounds(area)).toEqual({ x: 0, y: 0, width: 12, height: 13 });
  });

  it("returns null for unusable geometry", () => {
    expect(zoneBounds(null)).toBeNull();
    expect(zoneBounds({ polygons: [] })).toBeNull();
  });
});

describe("lineBounds", () => {
  it("includes pen handles", () => {
    expect(lineBounds([{ x: 0, y: 0, cout: { x: 5, y: -5 } }, { x: 10, y: 2 }])).toEqual({ x: 0, y: -5, width: 10, height: 7 });
  });
});

describe("textBounds", () => {
  it("is centered on the text and swaps extents at 90°", () => {
    const flat = textBounds({ x: 100, y: 50, text: "abcd", fontSize: 10, letterSpacing: 0, rotation: 0 });
    expect(flat.x + flat.width / 2).toBeCloseTo(100);
    expect(flat.width).toBeCloseTo(24);
    expect(flat.height).toBeCloseTo(12);
    const turned = textBounds({ x: 100, y: 50, text: "abcd", fontSize: 10, letterSpacing: 0, rotation: 90 });
    expect(turned.width).toBeCloseTo(12);
    expect(turned.height).toBeCloseTo(24);
  });
});

describe("focusRect", () => {
  it("pads around the center and never shrinks below the minimum", () => {
    const r = focusRect({ x: 10, y: 10, width: 45, height: 9 }, { width: 1200, height: 600 });
    expect(r.width).toBeCloseTo(100);
    expect(r.height).toBeCloseTo(100); // min = 1200 / 12
    expect(r.x + r.width / 2).toBeCloseTo(32.5);
    expect(r.y + r.height / 2).toBeCloseTo(14.5);
  });
});
