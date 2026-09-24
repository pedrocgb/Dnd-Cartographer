import { describe, expect, it } from "vitest";
import { cropToPixels, MAX_PORTRAIT_BYTES, parsePortraitCrop, portraitFileError } from "../src/server/assets/portrait-crop";

describe("parsePortraitCrop", () => {
  it("accepts a valid crop and defaults rotation to 0", () => {
    expect(parsePortraitCrop({ x: 10, y: 20, width: 50, height: 50 })).toEqual({ x: 10, y: 20, width: 50, height: 50, rotation: 0 });
  });

  it("keeps quarter-turn rotations only", () => {
    expect(parsePortraitCrop({ x: 0, y: 0, width: 100, height: 100, rotation: 270 })?.rotation).toBe(270);
    expect(parsePortraitCrop({ x: 0, y: 0, width: 100, height: 100, rotation: 45 })).toBeNull();
  });

  it("clamps rounding overshoot but rejects areas outside the image", () => {
    expect(parsePortraitCrop({ x: -0.001, y: 0, width: 100.005, height: 100 })).toEqual({ x: 0, y: 0, width: 100, height: 100, rotation: 0 });
    expect(parsePortraitCrop({ x: 60, y: 0, width: 50, height: 50 })).toBeNull();
    expect(parsePortraitCrop({ x: -5, y: 0, width: 50, height: 50 })).toBeNull();
    expect(parsePortraitCrop({ x: 0, y: 0, width: 0, height: 50 })).toBeNull();
  });

  it("rejects malformed input", () => {
    for (const raw of [null, undefined, "x", 3, {}, { x: "1", y: 0, width: 1, height: 1 }, { x: NaN, y: 0, width: 1, height: 1 }]) {
      expect(parsePortraitCrop(raw)).toBeNull();
    }
  });
});

describe("cropToPixels", () => {
  it("maps percentages to a pixel rectangle", () => {
    expect(cropToPixels({ x: 25, y: 10, width: 50, height: 50, rotation: 0 }, 2000, 1000)).toEqual({ left: 500, top: 100, width: 1000, height: 500 });
  });

  it("never leaves the image bounds", () => {
    const r = cropToPixels({ x: 99.99, y: 99.99, width: 0.5, height: 0.5, rotation: 0 }, 100, 100);
    expect(r.left + r.width).toBeLessThanOrEqual(100);
    expect(r.top + r.height).toBeLessThanOrEqual(100);
    expect(r.width).toBeGreaterThanOrEqual(1);
  });
});

describe("portraitFileError", () => {
  it("accepts supported images under the limit", () => {
    expect(portraitFileError({ type: "image/png", size: 1000 })).toBeNull();
  });

  it("refuses other types and oversized files", () => {
    expect(portraitFileError({ type: "image/gif", size: 1000 })).toMatch(/PNG, JPEG or WebP/);
    expect(portraitFileError({ type: "image/jpeg", size: MAX_PORTRAIT_BYTES + 1 })).toMatch(/over the 25 MiB limit/);
  });
});
