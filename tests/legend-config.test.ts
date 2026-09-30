import { describe, it, expect } from "vitest";
import { applyLegendPatch, DEFAULT_LEGEND, isLegendImageSrc, parseLegendConfig } from "../src/server/legends/legend-config";

const icon = { kind: "icon", key: "map-pin", color: "#ffffff", fill: "#3b82f6" };

describe("legend config", () => {
  it("clamps grid size and position", () => {
    const next = applyLegendPatch(DEFAULT_LEGEND, { columns: 99, rows: 0, position: { x: 2, y: -1 }, background: 5 });
    expect(next).toMatchObject({ columns: 6, rows: 1, position: { x: 1, y: 0 }, background: 1 });
  });

  it("keeps valid items in order, dropping bad and duplicate ones", () => {
    const next = applyLegendPatch(DEFAULT_LEGEND, {
      items: [
        { id: "a", image: icon, text: "Cities", bold: true },
        { id: "b", image: { kind: "icon", key: "not-an-icon" }, text: "x" },
        { id: "a", image: icon, text: "dup" },
        { id: "c", image: { kind: "upload", src: "https://evil.example/x.png" }, text: "y" },
        { id: "d", image: icon, text: "Roads", italic: true, strike: "yes" },
      ],
    });
    expect(next.items.map((i) => i.id)).toEqual(["a", "d"]);
    expect(next.items[0]).toMatchObject({ bold: true, italic: false, image: { color: "#FFFFFF", fill: "#3B82F6" } });
    expect(next.items[1]).toMatchObject({ italic: true, strike: false });
  });

  it("accepts only our own uploaded images", () => {
    expect(isLegendImageSrc("/api/article-images/0f8fad5b-d9cb-469f-a165-70867728950e.webp")).toBe(true);
    expect(isLegendImageSrc("/api/article-images/../secret.webp")).toBe(false);
  });

  it("an empty title means none; a corrupt stored config gives the defaults", () => {
    expect(applyLegendPatch(DEFAULT_LEGEND, { title: "   " }).title).toBeNull();
    expect(parseLegendConfig("{not json")).toEqual(DEFAULT_LEGEND);
    expect(parseLegendConfig('{"columns":3}').columns).toBe(3);
  });
});
