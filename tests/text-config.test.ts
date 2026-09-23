import { describe, expect, it } from "vitest";
import { defaultTextStyle, normalizeAngle, sanitizeTextPatch } from "../src/server/texts/text-config";
import { isMapFontKey, mapFontFamily, MAP_FONTS } from "../src/server/texts/fonts";

const frame = { width: 4000, height: 2000 };

describe("sanitizeTextPatch", () => {
  it("keeps only valid, sent fields", () => {
    expect(sanitizeTextPatch({ bold: "yes", fontKey: "comic-sans", align: "justify", junk: 1 }, frame)).toEqual({});
    expect(sanitizeTextPatch({ bold: true, fontKey: "cinzel", align: "right" }, frame)).toEqual({ bold: true, fontKey: "cinzel", align: "right" });
  });

  it("clamps numbers to their ranges and the frame", () => {
    const out = sanitizeTextPatch(
      { x: -5, y: 99999, fontSize: 0, curve: 500, letterSpacing: -9, outlineOpacity: 2, shadowDistance: 9, outlineWidth: -1 },
      frame
    );
    expect(out).toEqual({ x: 0, y: 2000, fontSize: 1, curve: 100, letterSpacing: -0.2, outlineOpacity: 1, shadowDistance: 1, outlineWidth: 0 });
  });

  it("normalizes angles and colors", () => {
    expect(sanitizeTextPatch({ rotation: 270, shadowAngle: -190, color: "#abcdef", outlineColor: "nope" }, frame)).toEqual({
      rotation: -90,
      shadowAngle: 170,
      color: "#ABCDEF",
      outlineColor: "#000000",
    });
  });

  it("ignores non-finite numbers and caps text length", () => {
    expect(sanitizeTextPatch({ x: Number.NaN, rotation: Infinity }, frame)).toEqual({});
    expect(sanitizeTextPatch({ text: "a".repeat(5000) }, frame).text).toHaveLength(2000);
  });
});

describe("defaults and fonts", () => {
  it("sizes the default font from the frame", () => {
    expect(defaultTextStyle(6000, 3000).fontSize).toBe(100);
    expect(defaultTextStyle(100, 100).fontSize).toBe(8);
  });

  it("normalizeAngle wraps to -180..180", () => {
    expect(normalizeAngle(360)).toBe(0);
    expect(normalizeAngle(181)).toBe(-179);
    expect(normalizeAngle(-181)).toBe(179);
  });

  it("maps font keys to their CSS variable, falling back to the default", () => {
    expect(MAP_FONTS.length).toBeGreaterThanOrEqual(10);
    expect(isMapFontKey("lora")).toBe(true);
    expect(mapFontFamily("lora")).toBe("var(--map-font-lora), serif");
    expect(mapFontFamily("unknown")).toBe("var(--map-font-cinzel), serif");
  });
});
