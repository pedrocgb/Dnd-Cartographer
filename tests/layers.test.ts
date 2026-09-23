import { describe, expect, it } from "vitest";
import { drawnImages, drawnLayerIds, itemsInLayers, moveLayer, sortLayers, type MapLayerData } from "../src/components/layer-images";

function layer(id: string, sortOrder: number, extra: Partial<MapLayerData> = {}): MapLayerData {
  return {
    id,
    mapId: "m",
    name: id,
    sortOrder,
    visible: true,
    imageOpacity: 1,
    imageAlwaysVisible: false,
    zonesAlwaysVisible: false,
    markersAlwaysVisible: false,
    textsAlwaysVisible: false,
    linesAlwaysVisible: false,
    asset: { id: `asset-${id}`, width: 100, height: 50 },
    pendingAsset: null,
    ...extra,
  };
}

describe("sortLayers", () => {
  it("orders by sortOrder ascending (top of the list first)", () => {
    expect(sortLayers([layer("b", 2), layer("a", -1), layer("c", 0)]).map((l) => l.id)).toEqual(["a", "c", "b"]);
  });
});

describe("drawnImages", () => {
  it("draws only the active layer's image by default", () => {
    const layers = [layer("top", 0), layer("bottom", 1)];
    expect(drawnImages(layers, "bottom").map((d) => d.layerId)).toEqual(["bottom"]);
  });

  it("adds always-draw images, painting the bottom of the list first", () => {
    const layers = [layer("top", 0, { imageAlwaysVisible: true }), layer("mid", 1), layer("base", 2, { imageAlwaysVisible: true })];
    expect(drawnImages(layers, "mid").map((d) => d.layerId)).toEqual(["base", "mid", "top"]);
  });

  it("skips hidden layers, including their always-draw image", () => {
    const layers = [layer("a", 0, { visible: false }), layer("base", 1, { imageAlwaysVisible: true, visible: false })];
    expect(drawnImages(layers, "a")).toEqual([]);
  });

  it("skips layers without an image and carries opacity", () => {
    const layers = [layer("empty", 0, { asset: null }), layer("base", 1, { imageAlwaysVisible: true, imageOpacity: 0.4 })];
    expect(drawnImages(layers, "empty")).toEqual([{ layerId: "base", assetId: "asset-base", opacity: 0.4 }]);
  });
});

describe("moveLayer", () => {
  const ids = ["a", "b", "c", "d"];

  it("dragging down lands after the target", () => {
    expect(moveLayer(ids, "a", "c")).toEqual(["b", "c", "a", "d"]);
  });

  it("dragging up lands before the target", () => {
    expect(moveLayer(ids, "d", "b")).toEqual(["a", "d", "b", "c"]);
  });

  it("is a no-op for the same or an unknown target", () => {
    expect(moveLayer(ids, "b", "b")).toEqual(ids);
    expect(moveLayer(ids, "b", "zz")).toEqual(ids);
  });
});

describe("drawnLayerIds", () => {
  it("is only the active layer while no flag is set", () => {
    const layers = [layer("top", 0), layer("bottom", 1)];
    expect(drawnLayerIds(layers, "top", "zonesAlwaysVisible")).toEqual(["top"]);
  });

  it("adds flagged visible layers in paint order (bottom of the list first)", () => {
    const layers = [layer("top", 0, { linesAlwaysVisible: true }), layer("mid", 1), layer("bottom", 2, { linesAlwaysVisible: true })];
    expect(drawnLayerIds(layers, "mid", "linesAlwaysVisible")).toEqual(["bottom", "mid", "top"]);
    expect(drawnLayerIds(layers, "mid", "textsAlwaysVisible")).toEqual(["mid"]);
  });

  it("skips hidden layers, including a hidden active layer", () => {
    const layers = [layer("a", 0, { markersAlwaysVisible: true, visible: false }), layer("b", 1, { visible: false })];
    expect(drawnLayerIds(layers, "b", "markersAlwaysVisible")).toEqual([]);
  });
});

describe("itemsInLayers", () => {
  it("keeps items of drawn layers, ordered by layer then original order", () => {
    const items = [
      { id: 1, layerId: "top" },
      { id: 2, layerId: "bottom" },
      { id: 3, layerId: "other" },
      { id: 4, layerId: "top" },
      { id: 5, layerId: null },
    ];
    expect(itemsInLayers(items, (i) => i.layerId, ["bottom", "top"]).map((i) => i.id)).toEqual([2, 1, 4]);
  });
});
