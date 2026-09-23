import { describe, expect, it } from "vitest";
import { applyStroke, toMultiPolygon, translateArea } from "../src/components/zone-paint";
import { validateAreaGeometry, validateZoneGeometry } from "../src/server/zones/zone-config";

const IMAGE = { w: 1000, h: 800 };

function area(polygons: [number, number][][][]) {
  let a = 0;
  for (const polygon of polygons)
    polygon.forEach((ring, i) => {
      let r = 0;
      for (let k = 0; k < ring.length - 1; k++) r += ring[k][0] * ring[k + 1][1] - ring[k + 1][0] * ring[k][1];
      a += (i === 0 ? 1 : -1) * Math.abs(r / 2);
    });
  return a;
}

describe("applyStroke", () => {
  it("creates a round dab close to πr²", () => {
    const g = applyStroke(null, [{ x: 500, y: 400 }], 50, "add", IMAGE)!;
    expect(g.polygons).toHaveLength(1);
    expect(area(g.polygons)).toBeGreaterThan(Math.PI * 50 * 50 * 0.97);
    expect(area(g.polygons)).toBeLessThan(Math.PI * 50 * 50 * 1.01);
    expect(validateAreaGeometry(g, IMAGE.w, IMAGE.h)).not.toBeNull();
  });

  it("sweeps a stroke into a capsule and clips it to the image", () => {
    const g = applyStroke(null, [{ x: -100, y: 400 }, { x: 300, y: 400 }], 20, "add", IMAGE)!;
    const xs = g.polygons.flat(2).map(([x]) => x);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(area(g.polygons)).toBeGreaterThan(320 * 40 * 0.95);
    expect(validateAreaGeometry(g, IMAGE.w, IMAGE.h)).not.toBeNull();
  });

  it("unions onto an existing shape and keeps separate islands", () => {
    const base = toMultiPolygon({ x: 100, y: 100, width: 100, height: 100 });
    const g = applyStroke(base, [{ x: 700, y: 600 }], 30, "add", IMAGE)!;
    expect(g.polygons).toHaveLength(2);
  });

  it("erasing the middle leaves a hole", () => {
    const base = toMultiPolygon({ x: 100, y: 100, width: 400, height: 400 });
    const g = applyStroke(base, [{ x: 300, y: 300 }], 50, "erase", IMAGE)!;
    expect(g.polygons).toHaveLength(1);
    expect(g.polygons[0]).toHaveLength(2);
    expect(area(g.polygons)).toBeLessThan(400 * 400);
  });

  it("erasing everything returns null", () => {
    const base = toMultiPolygon({ x: 490, y: 390, radius: 10 });
    expect(applyStroke(base, [{ x: 500, y: 400 }], 100, "erase", IMAGE)).toBeNull();
  });
});

describe("repeated add/erase strokes", () => {
  // Regression: a floating-point boolean library threw "Unable to complete
  // output ring" when painting back over a freshly erased area.
  it("never throws and always stays valid", () => {
    let seed = 42;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    let geom = applyStroke(null, [{ x: 500, y: 400 }], 80, "add", IMAGE)!.polygons;
    for (let i = 0; i < 150; i++) {
      const start = { x: 300 + rand() * 400, y: 200 + rand() * 400 };
      const pts = Array.from({ length: 30 }, (_, k) => ({ x: start.x + k * (rand() * 8 - 4), y: start.y + k * (rand() * 8 - 4) }));
      const next = applyStroke(geom, pts, 5 + rand() * 60, i % 2 === 0 ? "erase" : "add", IMAGE);
      if (next) {
        expect(validateAreaGeometry(next, IMAGE.w, IMAGE.h)).not.toBeNull();
        geom = next.polygons;
      } else {
        geom = applyStroke(null, [start], 50, "add", IMAGE)!.polygons;
      }
    }
  });
});

describe("translateArea", () => {
  it("clamps movement to the image", () => {
    const g = applyStroke(null, [{ x: 900, y: 400 }], 50, "add", IMAGE)!;
    const moved = translateArea(g, 500, 0, IMAGE);
    expect(Math.max(...moved.polygons.flat(2).map(([x]) => x))).toBeCloseTo(IMAGE.w, 5);
  });
});

describe("validateAreaGeometry", () => {
  const ring: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 0]];
  it("rejects malformed and out-of-bounds areas", () => {
    expect(validateAreaGeometry({ polygons: [] }, 100, 100)).toBeNull();
    expect(validateAreaGeometry({ polygons: [[[[0, 0], [1, 1]]]] }, 100, 100)).toBeNull();
    expect(validateAreaGeometry({ polygons: [[[[0, 0], [500, 0], [0, 5], [0, 0]]]] }, 100, 100)).toBeNull();
    expect(validateAreaGeometry({ polygons: [[ring]] }, 100, 100)).not.toBeNull();
  });
  it("is reachable through validateZoneGeometry", () => {
    expect(validateZoneGeometry("area", { polygons: [[ring]] }, 100, 100)).not.toBeNull();
  });
});
