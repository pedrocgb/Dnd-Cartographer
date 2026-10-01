import { describe, expect, it } from "vitest";
import { articleCatalog, buildArticleFolderTree, findNode, folderPath, foldersOfArticle, type ArticleFolder, type FolderNode } from "../src/components/articles/folder-tree";
import type { ArticleLists } from "../src/components/articles/ArticlesSidebar";

const lists = {
  territories: [{ id: "t1", name: "Waterdeep" }],
  people: [
    { id: "p1", name: "Laeral", kind: "npc" },
    { id: "p2", name: "Durnan", kind: "player" },
  ],
  organizations: [{ id: "o1", name: "Lords' Alliance" }],
  articles: [{ id: "a1", title: "Code Legal", template: "law" }],
} as unknown as ArticleLists;

const folders: ArticleFolder[] = [
  { id: "f1", name: "Waterdeep", parentId: null, color: null },
  { id: "f2", name: "Laws", parentId: "f1", color: null },
  { id: "f3", name: "Factions", parentId: null, color: "#FF0000" },
  { id: "loop", name: "Broken", parentId: "loop", color: null },
];

const items = [
  { folderId: "f1", articleId: "t1" },
  { folderId: "f1", articleId: "p1" },
  { folderId: "f2", articleId: "a1" },
  { folderId: "f3", articleId: "p1" },
  { folderId: "f3", articleId: "o1" },
  { folderId: "f3", articleId: "gone" }, // trashed: not in the live lists
];

const shape = (nodes: FolderNode[]): unknown => nodes.map((n) => [n.folder.name, n.articles.map((a) => a.name), ...(n.folders.length ? [shape(n.folders)] : [])]);

describe("article folders tree", () => {
  const catalog = articleCatalog(lists);

  it("knows each article's template, people by their kind", () => {
    expect(catalog.get("p2")?.template).toBe("playerCharacter");
    expect(catalog.get("a1")).toEqual({ id: "a1", name: "Code Legal", template: "law" });
  });

  it("nests folders, lets an article sit in several, and hides trashed ones", () => {
    expect(shape(buildArticleFolderTree(folders, items, catalog))).toEqual([
      ["Broken", []], // a self-parented folder falls back to the top level
      ["Factions", ["Laeral", "Lords' Alliance"]],
      ["Waterdeep", ["Laeral", "Waterdeep"], [["Laws", ["Code Legal"]]]],
    ]);
  });

  it("searches: a matching folder keeps everything, others keep only matches", () => {
    expect(shape(buildArticleFolderTree(folders, items, catalog, "laws"))).toEqual([["Waterdeep", [], [["Laws", ["Code Legal"]]]]]);
    expect(shape(buildArticleFolderTree(folders, items, catalog, "laeral"))).toEqual([
      ["Factions", ["Laeral"]],
      ["Waterdeep", ["Laeral"]],
    ]);
  });

  it("finds nodes, paths and an article's folders", () => {
    const tree = buildArticleFolderTree(folders, items, catalog);
    expect(findNode(tree, "f2")?.articles.map((a) => a.id)).toEqual(["a1"]);
    expect(findNode(tree, "nope")).toBeNull();
    expect(folderPath(folders, "f2").map((f) => f.name)).toEqual(["Waterdeep"]);
    expect(folderPath(folders, "loop")).toEqual([]);
    expect(foldersOfArticle(folders, items, "p1").map((f) => f.name)).toEqual(["Factions", "Waterdeep"]);
  });
});
