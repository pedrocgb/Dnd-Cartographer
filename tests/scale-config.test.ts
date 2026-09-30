import { describe, it, expect } from "vitest";
import { applyScalePatch, DEFAULT_SCALE, formatNumber, niceFloor, scaleBarLayout } from "../src/server/scale/scale-config";

describe("scale config", () => {
  it("drops invalid values and clamps numbers", () => {
    const next = applyScalePatch(DEFAULT_SCALE, { unit: "parsecs", steps: 40, stepValue: -3, framePxPerUnit: 0, subdivideFirst: 3, style: "ticks" });
    expect(next).toMatchObject({ unit: "km", steps: 10, stepValue: 50, framePxPerUnit: null, subdivideFirst: 0, style: "ticks" });
    expect(applyScalePatch(DEFAULT_SCALE, { framePxPerUnit: 12.5 }).framePxPerUnit).toBe(12.5);
  });

  it("niceFloor follows the 1-2-5 series", () => {
    expect([0.7, 1, 3, 7, 19, 49, 51, 999].map(niceFloor)).toEqual([0.5, 1, 2, 5, 10, 20, 50, 500]);
  });

  it("keeps the configured step while it fits", () => {
    const layout = scaleBarLayout(1, { stepValue: 50, steps: 4, autoStep: true }, 400);
    expect(layout).toMatchObject({ stepValue: 50, stepPx: 50, totalPx: 200, labels: ["0", "50", "100", "150", "200"] });
  });

  it("auto-adjusts the step when zoomed far in or out", () => {
    expect(scaleBarLayout(10, { stepValue: 50, steps: 4, autoStep: true }, 400)?.stepValue).toBe(10);
    expect(scaleBarLayout(0.01, { stepValue: 50, steps: 4, autoStep: true }, 400)?.stepValue).toBe(10000);
    expect(scaleBarLayout(10, { stepValue: 50, steps: 4, autoStep: false }, 400)?.totalPx).toBe(2000);
  });

  it("formats with up to 3 significant digits", () => {
    expect([0, 0.125, 1.5, 12.34, 1234.5].map(formatNumber)).toEqual(["0", "0.125", "1.5", "12.3", "1,235"]);
  });
});
