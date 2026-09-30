import { describe, expect, it } from "vitest";
import { orderLinks, promotedAfterRemoval } from "../src/server/markers/link-order";
import { excerptOf } from "../src/server/documents/excerpt";
import {
  BACKGROUND_SHAPES,
  ICON_KEYS,
  TEMPLATE_MARKER_DEFAULTS,
  importanceSize,
  isValidBackgroundShape,
  isValidImportance,
  isValidLabelMode,
  isValidMarkerCategory,
  shapeAnchor,
  markerGeometry,
} from "../src/server/markers/icon-registry";
import { isArticleTemplate } from "../src/server/articles/templates";

const link = (id: string, day: number, isPrimary = false) => ({ id, isPrimary, createdAt: new Date(2026, 0, day) });

describe("marker article link order", () => {
  it("puts the primary link first, then oldest first", () => {
    const ordered = orderLinks([link("c", 3), link("a", 1), link("b", 2, true)]);
    expect(ordered.map((l) => l.id)).toEqual(["b", "a", "c"]);
  });

  it("promotes the oldest remaining link when no primary is left", () => {
    expect(promotedAfterRemoval([link("c", 3), link("a", 1)])?.id).toBe("a");
  });

  it("promotes nothing while a primary remains, or when nothing remains", () => {
    expect(promotedAfterRemoval([link("c", 3, true), link("a", 1)])).toBeNull();
    expect(promotedAfterRemoval([])).toBeNull();
  });
});

describe("template marker defaults", () => {
  it("only uses real templates, icons and categories", () => {
    for (const [template, defaults] of Object.entries(TEMPLATE_MARKER_DEFAULTS)) {
      expect(isArticleTemplate(template), template).toBe(true);
      expect(ICON_KEYS.has(defaults!.iconKey), defaults!.iconKey).toBe(true);
      expect(isValidMarkerCategory(defaults!.category)).toBe(true);
    }
  });
});

describe("marker appearance options", () => {
  it("anchors only the pin at its tip", () => {
    expect(shapeAnchor("pin")).toBe("tip");
    for (const shape of BACKGROUND_SHAPES.filter((s) => s.key !== "pin")) expect(shapeAnchor(shape.key)).toBe("center");
  });

  it("keeps the old shapes valid and rejects unknown values", () => {
    for (const key of ["circle", "square", "none", "pin", "diamond", "shield"]) expect(isValidBackgroundShape(key)).toBe(true);
    expect(isValidBackgroundShape("hexagon")).toBe(false);
    expect(isValidLabelMode("always")).toBe(true);
    expect(isValidLabelMode("sometimes")).toBe(false);
    expect(isValidImportance("major")).toBe(true);
    expect(isValidImportance("huge")).toBe(false);
  });

  it("sizes by importance, falling back to normal", () => {
    expect(importanceSize("major")).toBeGreaterThan(importanceSize("normal"));
    expect(importanceSize("minor")).toBeLessThan(importanceSize("normal"));
    expect(importanceSize("bogus")).toBe(importanceSize("normal"));
  });
});

describe("excerptOf", () => {
  it("flattens whitespace and keeps short text whole", () => {
    expect(excerptOf("  A  keep\n\non the  hill ")).toBe("A keep on the hill");
  });

  it("cuts long text at a word boundary with an ellipsis", () => {
    const out = excerptOf("word ".repeat(100), 30);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(31);
    expect(out).not.toMatch(/ …$/);
  });
});

describe("markerGeometry", () => {
  it("lifts only the pin, whose tip is the anchor", () => {
    expect(markerGeometry("circle", "normal")).toEqual({ glyph: 22, box: 34, height: 34, lift: 0 });
    const pin = markerGeometry("pin", "normal");
    expect(pin.height).toBeGreaterThan(pin.box);
    expect(pin.lift).toBe(pin.height - pin.box / 2);
  });
});
