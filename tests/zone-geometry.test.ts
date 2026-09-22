import { describe, expect, it } from "vitest";
import {
  validateRectGeometry,
  validateCircleGeometry,
  validatePolygonGeometry,
  randomZoneColor,
} from "../src/server/zones/zone-config";

const W = 1000;
const H = 800;

describe("validateRectGeometry", () => {
  it("accepts an in-bounds rectangle", () => {
    expect(validateRectGeometry({ x: 10, y: 10, width: 100, height: 50 }, W, H)).toEqual({
      x: 10,
      y: 10,
      width: 100,
      height: 50,
    });
  });

  it("rejects zero/negative width or height", () => {
    expect(validateRectGeometry({ x: 0, y: 0, width: 0, height: 50 }, W, H)).toBeNull();
    expect(validateRectGeometry({ x: 0, y: 0, width: 50, height: -1 }, W, H)).toBeNull();
  });

  it("rejects a rectangle extending past the image bounds", () => {
    expect(validateRectGeometry({ x: 950, y: 10, width: 100, height: 50 }, W, H)).toBeNull();
    expect(validateRectGeometry({ x: -10, y: 10, width: 100, height: 50 }, W, H)).toBeNull();
  });

  it("rejects non-finite or missing fields", () => {
    expect(validateRectGeometry({ x: 0, y: 0, width: Infinity, height: 50 }, W, H)).toBeNull();
    expect(validateRectGeometry({ x: 0, width: 50, height: 50 }, W, H)).toBeNull();
    expect(validateRectGeometry(null, W, H)).toBeNull();
  });
});

describe("validateCircleGeometry", () => {
  it("accepts an in-bounds circle", () => {
    expect(validateCircleGeometry({ x: 500, y: 400, radius: 100 }, W, H)).toEqual({ x: 500, y: 400, radius: 100 });
  });

  it("rejects zero/negative radius", () => {
    expect(validateCircleGeometry({ x: 500, y: 400, radius: 0 }, W, H)).toBeNull();
  });

  it("rejects a circle extending past the image bounds", () => {
    expect(validateCircleGeometry({ x: 20, y: 400, radius: 100 }, W, H)).toBeNull();
    expect(validateCircleGeometry({ x: 500, y: 780, radius: 100 }, W, H)).toBeNull();
  });
});

function square(x: number, y: number, size: number) {
  return {
    points: [
      { x, y },
      { x: x + size, y },
      { x: x + size, y: y + size },
      { x, y: y + size },
    ],
  };
}

describe("validatePolygonGeometry", () => {
  it("accepts a simple convex polygon", () => {
    expect(validatePolygonGeometry(square(10, 10, 100), W, H)).toEqual(square(10, 10, 100));
  });

  it("accepts a concave (non-convex) simple polygon", () => {
    const concave = {
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 50, y: 40 },
        { x: 0, y: 100 },
      ],
    };
    expect(validatePolygonGeometry(concave, W, H)).toEqual(concave);
  });

  it("rejects fewer than three vertices", () => {
    expect(validatePolygonGeometry({ points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] }, W, H)).toBeNull();
  });

  it("rejects a self-intersecting bow-tie polygon", () => {
    const bowtie = {
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
        { x: 100, y: 0 },
        { x: 0, y: 100 },
      ],
    };
    expect(validatePolygonGeometry(bowtie, W, H)).toBeNull();
  });

  it("rejects a zero-area collinear polygon", () => {
    const collinear = {
      points: [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 100, y: 0 },
      ],
    };
    expect(validatePolygonGeometry(collinear, W, H)).toBeNull();
  });

  it("rejects a duplicate nonadjacent vertex", () => {
    const dup = {
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 50, y: 50 },
        { x: 0, y: 0 },
        { x: 0, y: 100 },
      ],
    };
    expect(validatePolygonGeometry(dup, W, H)).toBeNull();
  });

  it("rejects vertices outside the image bounds", () => {
    expect(validatePolygonGeometry(square(950, 10, 100), W, H)).toBeNull();
  });

  it("accepts adjacent edges sharing an endpoint without flagging a false intersection", () => {
    // A regular pentagon — every edge shares an endpoint with its neighbors, which must not
    // trip the self-intersection check that only rejects *nonadjacent* edge overlaps.
    const pentagon = {
      points: Array.from({ length: 5 }, (_, i) => {
        const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
        return { x: 500 + 100 * Math.cos(angle), y: 400 + 100 * Math.sin(angle) };
      }),
    };
    expect(validatePolygonGeometry(pentagon, W, H)).not.toBeNull();
  });
});

describe("randomZoneColor", () => {
  it("returns a valid 6-digit hex color", () => {
    for (let i = 0; i < 20; i++) {
      expect(randomZoneColor()).toMatch(/^#[0-9A-F]{6}$/);
    }
  });
});
