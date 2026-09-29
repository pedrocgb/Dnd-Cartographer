import { describe, expect, it } from "vitest";
import { clickSelection, dropMoves, dropOrder, editLayers, EMPTY_SELECTION, mixedKeys, sharedLayers } from "../src/components/multi-select";

const order = ["a", "b", "c", "d", "e"];
const plain = { toggle: false, range: false };
const ctrl = { toggle: true, range: false };
const shift = { toggle: false, range: true };

describe("clickSelection", () => {
  it("plain click picks only that item and anchors there", () => {
    expect(clickSelection({ ids: ["a", "b"], anchor: "a" }, "c", plain, order)).toEqual({ ids: ["c"], anchor: "c" });
  });

  it("Ctrl+click adds and removes one item", () => {
    const one = clickSelection(EMPTY_SELECTION, "b", ctrl, order);
    const two = clickSelection(one, "d", ctrl, order);
    expect(two).toEqual({ ids: ["b", "d"], anchor: "d" });
    expect(clickSelection(two, "b", ctrl, order)).toEqual({ ids: ["d"], anchor: "b" });
  });

  it("Shift+click picks the range from the anchor, either direction", () => {
    const start = clickSelection(EMPTY_SELECTION, "b", plain, order);
    expect(clickSelection(start, "d", shift, order).ids).toEqual(["b", "c", "d"]);
    const back = clickSelection({ ids: ["d"], anchor: "d" }, "a", shift, order);
    expect(back).toEqual({ ids: ["a", "b", "c", "d"], anchor: "d" });
  });

  it("Ctrl+Shift adds the range to the selection; Shift without an anchor is a plain click", () => {
    expect(clickSelection({ ids: ["e"], anchor: "b" }, "c", { toggle: true, range: true }, order).ids).toEqual(["e", "b", "c"]);
    expect(clickSelection(EMPTY_SELECTION, "c", shift, order)).toEqual({ ids: ["c"], anchor: "c" });
  });
});

describe("mixedKeys", () => {
  it("lists the fields that differ, comparing arrays by content", () => {
    const items = [
      { color: "#f00", width: 2, layers: ["x"] },
      { color: "#00f", width: 2, layers: ["x"] },
    ];
    expect([...mixedKeys(items)]).toEqual(["color"]);
    expect(mixedKeys([items[0], { ...items[0], layers: ["y"] }]).has("layers")).toBe(true);
    expect(mixedKeys([]).size).toBe(0);
  });
});

describe("sharedLayers and editLayers", () => {
  it("splits layers every item has from those only some have", () => {
    expect(sharedLayers([["x", "y"], ["x"], ["x", "z"]])).toEqual({ all: ["x"], some: ["y", "z"] });
  });

  it("adds and removes without duplicating", () => {
    expect(editLayers(["x", "y"], ["y", "z"], ["x"])).toEqual(["y", "z"]);
    expect(editLayers(undefined, ["x"], [])).toEqual(["x"]);
  });
});

describe("dropOrder and dropMoves", () => {
  const list = [
    { id: "a", sortOrder: 0 },
    { id: "b", sortOrder: 1 },
    { id: "c", sortOrder: 2 },
  ];

  it("reorders within a folder, returning only changed places", () => {
    expect(dropOrder(list, ["c"], "a", "before")).toEqual([
      { id: "c", sortOrder: 0 },
      { id: "a", sortOrder: 1 },
      { id: "b", sortOrder: 2 },
    ]);
    expect(dropOrder(list, ["a"], "b", "after")).toEqual([
      { id: "b", sortOrder: 0 },
      { id: "a", sortOrder: 1 },
    ]);
  });

  it("drops several items together at the end of a folder", () => {
    expect(dropMoves(list, ["x", "y"], null, "into", () => "other", "here")).toEqual(
      new Map([
        ["x", { folder: "here", sortOrder: 3 }],
        ["y", { folder: "here", sortOrder: 4 }],
      ])
    );
  });

  it("gives the folder only to items coming from another one", () => {
    const moves = dropMoves(list, ["x", "b"], "a", "after", (id) => (id === "x" ? null : "here"), "here");
    expect(moves.get("x")).toEqual({ folder: "here", sortOrder: 1 });
    expect(moves.get("b")).toEqual({ sortOrder: 2 });
    expect(moves.get("c")).toEqual({ sortOrder: 3 });
    expect(moves.has("a")).toBe(false);
  });
});
