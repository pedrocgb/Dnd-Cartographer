import { describe, expect, it } from "vitest";
import { growGrid, growImagePlacement, growMarkerUV, planFrameGrowth } from "../src/server/maps/frame-growth";

const frame = { width: 1000, height: 200 };
const image = (imageX: number, imageY: number, imageScale: number, assetWidth: number, assetHeight: number) => ({ imageX, imageY, imageScale, assetWidth, assetHeight });

describe("planFrameGrowth", () => {
  it("leaves a frame that already covers every image alone", () => {
    expect(planFrameGrowth(frame, [image(0, 0, 1, 1000, 200), image(0.1, 0.05, 0.5, 100, 20)])).toBeNull();
  });

  it("grows down for a taller image at the frame's width", () => {
    // 1000 px wide at 2:1 is 500 px tall, reaching 300 px below the frame.
    expect(planFrameGrowth(frame, [image(0, 0, 1, 2000, 1000)])).toEqual({ width: 1000, height: 500, dx: 0, dy: 0 });
  });

  it("grows left and up, moving the origin", () => {
    expect(planFrameGrowth(frame, [image(-0.1, -0.05, 0.5, 100, 20)])).toEqual({ width: 1100, height: 250, dx: 100, dy: 50 });
  });

  it("ignores images without a known size and sub-pixel noise", () => {
    expect(planFrameGrowth(frame, [image(-0.0001, 0, 1, 0, 0), image(-0.0001, 0, 1, 1000, 200)])).toBeNull();
  });
});

describe("coordinate rewrites keep everything in place", () => {
  const g = { width: 1100, height: 250, dx: 100, dy: 50 };

  it("markers", () => {
    const { u, v } = growMarkerUV(frame, g, 0.5, 0.5);
    expect(u * g.width).toBeCloseTo(500 + 100);
    expect(v * g.height).toBeCloseTo(100 + 50);
  });

  it("layer images", () => {
    const p = growImagePlacement(frame, g, { imageX: -0.1, imageY: -0.05, imageScale: 0.5 });
    expect(p.imageX).toBeCloseTo(0);
    expect(p.imageY).toBeCloseTo(0);
    expect(p.imageScale * g.width).toBeCloseTo(500);
  });

  it("grids keep their cell size and line positions", () => {
    const grown = growGrid(frame, g, { columns: 10, rows: 2, horizontalOffset: 0, verticalOffset: 0 }, 300);
    expect(grown.columns).toBe(11); // 100 px cells over 1100 px
    expect(grown.rows).toBe(3); // ≈100 px cells over 250 px
    expect(grown.horizontalOffset).toBeCloseTo(0); // the 100 px shift is exactly one cell
    expect(grown.verticalOffset).toBeCloseTo(((50 % (250 / 3)) / (250 / 3)) * 100);
  });
});
