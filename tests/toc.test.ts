import { describe, it, expect } from "vitest";
import { buildTocTree, type TocHeading } from "../src/components/rich-editor/toc";

const h = (level: number, text: string, pos: number): TocHeading => ({ level, text, pos });

describe("table of contents tree", () => {
  it("nests each heading under the closest lower-level heading before it", () => {
    const tree = buildTocTree([h(1, "Kingdom", 0), h(2, "Cities", 10), h(3, "Capital", 20), h(2, "Rivers", 30), h(1, "History", 40)]);
    expect(tree.map((e) => e.text)).toEqual(["Kingdom", "History"]);
    expect(tree[0].children.map((e) => [e.number, e.text])).toEqual([
      ["1.1", "Cities"],
      ["1.2", "Rivers"],
    ]);
    expect(tree[0].children[0].children[0]).toMatchObject({ number: "1.1.1", text: "Capital" });
    expect(tree[1].number).toBe("2");
  });

  it("skipped levels still nest, and a document starting at H2 has H2 roots", () => {
    const tree = buildTocTree([h(2, "Intro", 0), h(1, "Part", 5), h(3, "Deep", 9)]);
    expect(tree.map((e) => e.text)).toEqual(["Intro", "Part"]);
    expect(tree[1].children[0]).toMatchObject({ text: "Deep", number: "2.1" });
  });
});
