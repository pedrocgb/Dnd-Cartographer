import { describe, expect, it } from "vitest";
import { cleanFolderColor, cleanFolderName, folderMoveError, folderSubtree } from "../src/server/maps/folders";
import { buildMapTree, countMaps, type TreeEntry } from "../src/components/maps/map-tree";

const folders = [
  { id: "f1", name: "Continents", parentId: null },
  { id: "f2", name: "Cities", parentId: "f1" },
  { id: "f3", name: "Archive", parentId: null },
];

const shape = (entries: TreeEntry[]): unknown => entries.map((e) => [e.item.name, ...(e.children.length ? [shape(e.children)] : [])]);

describe("folderSubtree / folderMoveError", () => {
  it("collects nested folders", () => {
    expect([...folderSubtree(folders, "f1")].sort()).toEqual(["f1", "f2"]);
    expect([...folderSubtree(folders, "f3")]).toEqual(["f3"]);
  });

  it("refuses moving a folder into itself or its subfolders", () => {
    expect(folderMoveError(folders, "f1", "f2")).toBe("folderIntoItself");
    expect(folderMoveError(folders, "f1", "f1")).toBe("folderIntoItself");
    expect(folderMoveError(folders, "f2", "f3")).toBeNull();
    expect(folderMoveError(folders, "f2", null)).toBeNull();
    expect(folderMoveError(folders, "f2", "nope")).toBe("folderUnknownParent");
  });

  it("cleans colors", () => {
    expect(cleanFolderColor("#a1b2c3")).toBe("#A1B2C3");
    expect(cleanFolderColor(null)).toBeNull();
    expect(cleanFolderColor("red")).toBeUndefined();
    expect(cleanFolderColor("#12345")).toBeUndefined();
  });

  it("cleans names", () => {
    expect(cleanFolderName("  Realms ")).toBe("Realms");
    expect(cleanFolderName("   ")).toBeNull();
    expect(cleanFolderName(3)).toBeNull();
    expect(cleanFolderName("x".repeat(200))).toHaveLength(80);
  });
});

describe("buildMapTree", () => {
  const maps = [
    { id: "m1", name: "World", parentId: null, folderId: null },
    { id: "m2", name: "Capital", parentId: "m1", folderId: null },
    { id: "m3", name: "Harbor", parentId: "m1", folderId: "f2" },
    { id: "m4", name: "Lost map", parentId: null, folderId: "gone" },
  ];

  it("puts folders first, a folder beats the parent map, unknown folders fall to the root", () => {
    expect(shape(buildMapTree(folders, maps))).toEqual([
      ["Archive"],
      ["Continents", [["Cities", [["Harbor"]]]]],
      ["Lost map"],
      ["World", [["Capital"]]],
    ]);
  });

  it("search keeps matches and the folders/maps holding them", () => {
    expect(shape(buildMapTree(folders, maps, "harb"))).toEqual([["Continents", [["Cities", [["Harbor"]]]]]]);
    expect(shape(buildMapTree(folders, maps, "cities"))).toEqual([["Continents", [["Cities", [["Harbor"]]]]]]);
    expect(shape(buildMapTree(folders, maps, "capital"))).toEqual([["World", [["Capital"]]]]);
  });

  it("counts maps at any depth", () => {
    const continents = buildMapTree(folders, maps).find((e) => e.item.id === "f1")!;
    expect(countMaps(continents)).toBe(1);
  });
});
