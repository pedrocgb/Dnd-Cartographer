import { describe, expect, it } from "vitest";
import { centerAt, translateZoneGeometry } from "../src/components/paste-geometry";

const frame = { width: 1000, height: 500 };

describe("centerAt", () => {
  it("moves the bounds' center under the point", () => {
    expect(centerAt({ x: 100, y: 100, width: 50, height: 20 }, { x: 500, y: 250 }, frame)).toEqual({ dx: 375, dy: 140 });
  });

  it("keeps the item inside the frame", () => {
    expect(centerAt({ x: 100, y: 100, width: 50, height: 20 }, { x: 995, y: 2 }, frame)).toEqual({ dx: 850, dy: -100 });
  });

  it("pins an item larger than the frame to its top-left", () => {
    expect(centerAt({ x: 10, y: 10, width: 2000, height: 20 }, { x: 900, y: 10 }, frame).dx).toBe(-10);
  });
});

describe("translateZoneGeometry", () => {
  it("moves each shape kind", () => {
    expect(translateZoneGeometry({ x: 1, y: 2, width: 3, height: 4 }, 10, 20)).toEqual({ x: 11, y: 22, width: 3, height: 4 });
    expect(translateZoneGeometry({ x: 1, y: 2, radius: 3 }, 10, 20)).toEqual({ x: 11, y: 22, radius: 3 });
    expect(translateZoneGeometry({ points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }, 10, 20)).toEqual({ points: [{ x: 10, y: 20 }, { x: 11, y: 21 }] });
    expect(translateZoneGeometry({ polygons: [[[[0, 0], [1, 0], [0, 1], [0, 0]]]] }, 10, 20)).toEqual({
      polygons: [[[[10, 20], [11, 20], [10, 21], [10, 20]]]],
    });
  });
});
