import { describe, expect, it } from "vitest";
import { hitTest, hitText, inMultiPolygon, lineDistance, type HitScene } from "../src/components/hit-test";

const square = (x: number, y: number, s: number): [number, number][] => [
  [x, y],
  [x + s, y],
  [x + s, y + s],
  [x, y + s],
  [x, y],
];

describe("inMultiPolygon", () => {
  it("excludes holes", () => {
    const withHole = [[square(0, 0, 100), square(40, 40, 20)]];
    expect(inMultiPolygon(withHole, { x: 10, y: 10 })).toBe(true);
    expect(inMultiPolygon(withHole, { x: 50, y: 50 })).toBe(false);
    expect(inMultiPolygon(withHole, { x: 150, y: 50 })).toBe(false);
  });
});

describe("hitText", () => {
  // "abcd" at 10px: box 24 × 12 around (100, 100).
  const t = { id: "t", x: 100, y: 100, text: "abcd", fontSize: 10, letterSpacing: 0, rotation: 0 };
  it("uses the rotated box", () => {
    expect(hitText(t, { x: 111, y: 100 })).toBe(true);
    expect(hitText(t, { x: 100, y: 111 })).toBe(false);
    const turned = { ...t, rotation: 90 };
    expect(hitText(turned, { x: 100, y: 111 })).toBe(true);
    expect(hitText(turned, { x: 111, y: 100 })).toBe(false);
  });
});

describe("lineDistance", () => {
  it("measures to straight segments and sampled curves", () => {
    expect(lineDistance([{ x: 0, y: 0 }, { x: 100, y: 0 }], { x: 50, y: 5 })).toBeCloseTo(5);
    // A curve bulging up to y = 75 in the middle.
    const curve = [
      { x: 0, y: 0, cout: { x: 0, y: 100 } },
      { x: 100, y: 0, cin: { x: 100, y: 100 } },
    ];
    expect(lineDistance(curve, { x: 50, y: 75 })).toBeLessThan(1);
  });
});

describe("hitTest", () => {
  const scene: HitScene = {
    markers: [{ id: "m", x: 50, y: 50 }],
    texts: [],
    lines: [{ id: "l", points: [{ x: 0, y: 200 }, { x: 200, y: 200 }], width: 2 }],
    zones: [
      { id: "bottom", bounds: { x: 0, y: 0, width: 300, height: 300 }, polygons: [[square(0, 0, 300)]] },
      { id: "top", bounds: { x: 100, y: 100, width: 50, height: 50 }, polygons: [[square(100, 100, 50)]] },
    ],
  };
  it("picks the topmost item, markers above everything", () => {
    expect(hitTest(scene, { x: 55, y: 55 }, 1)?.id).toBe("m");
    expect(hitTest(scene, { x: 120, y: 120 }, 1)?.id).toBe("top");
    expect(hitTest(scene, { x: 250, y: 20 }, 1)?.id).toBe("bottom");
    expect(hitTest(scene, { x: 100, y: 204 }, 1)?.id).toBe("l");
    expect(hitTest(scene, { x: 400, y: 400 }, 1)).toBeNull();
  });
  it("scales screen tolerances with zoom", () => {
    // Zoomed out 4×: 14 screen px around the marker is 56 image px.
    expect(hitTest(scene, { x: 100, y: 50 }, 0.25)?.id).toBe("m");
  });
});
