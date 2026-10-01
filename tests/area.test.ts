import { describe, expect, it } from "vitest";
import { areaReadings, formatArea, formatLength, shapeAreaPx, shapePerimeterPx, splitReadings, zoneAreaShape } from "../src/server/scale/area";

const calibrated = (unit: "km" | "mi" | "custom", framePxPerUnit = 10) => ({ framePxPerUnit, unit, customLabel: "days" });

describe("shape area and perimeter (frame px)", () => {
  it("measures rectangles, circles and polygons", () => {
    expect(shapeAreaPx({ kind: "rectangle", x: 0, y: 0, width: 20, height: 5 })).toBe(100);
    expect(shapePerimeterPx({ kind: "rectangle", x: 0, y: 0, width: 20, height: 5 })).toBe(50);
    expect(shapeAreaPx({ kind: "circle", x: 0, y: 0, radius: 2 })).toBeCloseTo(4 * Math.PI);
    const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    expect(shapeAreaPx({ kind: "polygon", points: square })).toBeCloseTo(100);
    expect(shapeAreaPx({ kind: "polygon", points: [...square].reverse() })).toBeCloseTo(100);
    expect(shapePerimeterPx({ kind: "polygon", points: square })).toBeCloseTo(40);
  });

  it("counts both loops of a self-crossing polygon", () => {
    // A bow tie: two triangles of 25 px² each, which a plain shoelace would cancel to 0.
    const bowTie = [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 10, y: 0 }, { x: 0, y: 10 }];
    expect(shapeAreaPx({ kind: "polygon", points: bowTie })).toBeCloseTo(50);
  });

  it("subtracts a painted area's holes", () => {
    const outer: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
    const hole: [number, number][] = [[2, 2], [4, 2], [4, 4], [2, 4], [2, 2]];
    expect(shapeAreaPx({ kind: "area", polygons: [[outer, hole]] })).toBeCloseTo(96);
    expect(shapePerimeterPx({ kind: "area", polygons: [[outer, hole]] })).toBeCloseTo(48);
  });

  it("reads stored zones", () => {
    expect(zoneAreaShape("circle", '{"x":1,"y":2,"radius":3}')).toEqual({ kind: "circle", x: 1, y: 2, radius: 3 });
    expect(zoneAreaShape("polygon", "not json")).toBeNull();
  });
});

describe("area in real units", () => {
  it("is empty until the scale is calibrated", () => {
    expect(areaReadings(100, { framePxPerUnit: null, unit: "km", customLabel: "" })).toEqual([]);
    expect(formatArea(100, { framePxPerUnit: null, unit: "km", customLabel: "" })).toBeNull();
  });

  it("converts through the scale, the map's unit first", () => {
    // 10 px per km: 100 px² is 1 km².
    const readings = areaReadings(100, calibrated("km"));
    expect(readings[0]).toMatchObject({ key: "km", unit: "km²", value: 1 });
    const by = Object.fromEntries(readings.map((r) => [r.key, r.value]));
    expect(by.m).toBeCloseTo(1_000_000);
    expect(by.hectares).toBeCloseTo(100);
    expect(by.acres).toBeCloseTo(247.105, 2);
    expect(by.mi).toBeCloseTo(0.386102, 5);
    expect(readings).toHaveLength(8);
    expect(areaReadings(100, calibrated("mi"))[0].unit).toBe("mi²");
  });

  it("keeps a custom unit squared, with no conversions", () => {
    expect(areaReadings(400, calibrated("custom"))).toEqual([{ key: "custom", unit: "days²", value: 4 }]);
    expect(formatLength(25, calibrated("custom"))).toBe("2.5 days");
  });
});

describe("readings by measurement system", () => {
  it("leads with the user's system and keeps the rest for show more", () => {
    const readings = areaReadings(100, calibrated("mi"));
    const metric = splitReadings(readings, "metric");
    expect(metric.main.map((r) => r.unit)).toEqual(["km²", "m²", "hectares"]);
    expect(metric.more.map((r) => r.unit)).toEqual(["mi²", "acres", "ft²", "yd²", "sq leagues"]);
    const imperial = splitReadings(readings, "imperial");
    expect(imperial.main.map((r) => r.unit)).toEqual(["mi²", "acres", "ft²", "yd²"]);
    expect(imperial.more.map((r) => r.unit)).toEqual(["km²", "m²", "hectares", "sq leagues"]);
  });

  it("always shows a custom unit", () => {
    expect(splitReadings(areaReadings(400, calibrated("custom")), "metric")).toEqual({ main: [{ key: "custom", unit: "days²", value: 4 }], more: [] });
  });
});
