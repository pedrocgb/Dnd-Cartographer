import { describe, it, expect } from "vitest";
import { sanitizeRoutePoints, sanitizeRouteStyle } from "../src/server/travel/route-config";
import { DEFAULT_TRAVEL, sanitizeTravelSettings } from "../src/server/travel/travel";

const frame = { width: 1000, height: 500 };

describe("route config", () => {
  it("needs 2+ finite points and clamps them into the frame", () => {
    expect(sanitizeRoutePoints([{ x: 1, y: 1 }], frame)).toBeNull();
    expect(sanitizeRoutePoints([{ x: 1, y: 1 }, { x: "2", y: 1 }], frame)).toBeNull();
    expect(sanitizeRoutePoints([{ x: -5, y: 10 }, { x: 2000, y: 600 }], frame)).toEqual([
      { x: 0, y: 10 },
      { x: 1000, y: 500 },
    ]);
  });

  it("keeps only valid style values", () => {
    expect(sanitizeRouteStyle({ color: "#ff0000", width: 99, style: "wavy" })).toEqual({ color: "#FF0000", width: 12 });
  });

  it("validates travel settings key by key", () => {
    const s = sanitizeTravelSettings({ mode: "galley", pace: "sprint", hoursPerDay: 30.4, partySize: 2.6, gallop: "yes", difficultShare: 2 });
    expect(s).toMatchObject({ mode: "galley", pace: DEFAULT_TRAVEL.pace, hoursPerDay: 24, partySize: 3, gallop: false, difficultShare: 1 });
    expect(sanitizeTravelSettings({ mode: "teleport" }).mode).toBe(DEFAULT_TRAVEL.mode);
  });
});
