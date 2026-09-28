import { describe, expect, it } from "vitest";
import { CARD_WIDTH, layoutFamily, selectFamily, type FamilyRelation } from "../src/server/relations/family";

const parent = (fromId: string, toId: string, parentKind: string | null = "biological"): FamilyRelation => ({ type: "parent", fromId, toId, parentKind });
const spouse = (fromId: string, toId: string): FamilyRelation => ({ type: "spouse", fromId, toId, parentKind: null });

const noOverlap = (tree: ReturnType<typeof layoutFamily>) => {
  const cards = tree.nodes.filter((n) => n.kind !== "union");
  for (const a of cards) for (const b of cards) if (a !== b && a.y === b.y) expect(Math.abs(a.x - b.x), `${a.id} / ${b.id}`).toBeGreaterThanOrEqual(CARD_WIDTH);
};

describe("family selection", () => {
  const rels = [parent("gp", "p"), parent("p", "me"), parent("p", "sis"), spouse("p", "q"), parent("q", "me"), parent("me", "kid"), parent("kid", "gk"), parent("gk", "ggk")];

  it("keeps a generation window around the focus, spouses included", () => {
    const { generation } = selectFamily("me", rels, { up: 1, down: 1 });
    expect([...generation.keys()].sort()).toEqual(["kid", "me", "p", "q", "sis"]);
    expect(generation.get("p")).toBe(-1);
  });

  it("bloodline: all blood relatives, partners faint, adoptive links left out", () => {
    const withAdopt = [...rels, parent("stranger", "me", "adoptive"), spouse("sis", "inlaw")];
    const { generation, faint } = selectFamily("me", withAdopt, { bloodline: true });
    expect(generation.has("ggk")).toBe(true);
    expect(generation.has("stranger")).toBe(false);
    expect(faint.has("inlaw")).toBe(true);
    expect(faint.has("q")).toBe(false); // a biological parent is blood
  });
});

describe("family layout", () => {
  it("puts a person between two spouses, each couple with its own union", () => {
    const rels = [spouse("a", "b"), spouse("b", "c"), parent("a", "k1"), parent("b", "k1"), parent("b", "k2"), parent("c", "k2")];
    const tree = layoutFamily("b", rels, {});
    const xs = Object.fromEntries(tree.nodes.map((n) => [n.id, n.x]));
    expect(xs.b).toBeGreaterThan(Math.min(xs.a, xs.c));
    expect(xs.b).toBeLessThan(Math.max(xs.a, xs.c));
    expect(tree.nodes.filter((n) => n.kind === "union")).toHaveLength(2);
    noOverlap(tree);
  });

  it("gives single-parent children an Unknown partner and marks inferred couples", () => {
    const rels = [parent("p", "k1"), parent("p", "k2"), parent("q", "k2")];
    const tree = layoutFamily("p", rels, {});
    expect(tree.nodes.some((n) => n.id === "unknown:p")).toBe(true);
    expect(tree.nodes.find((n) => n.id === "union:p|q")?.inferred).toBe(true);
    noOverlap(tree);
  });

  it("hangs a child from any number of parents, and draws adoptive parents apart", () => {
    const rels = [parent("a", "k"), parent("b", "k"), parent("c", "k"), parent("d", "k", "adoptive")];
    const tree = layoutFamily("k", rels, {});
    expect(tree.nodes.some((n) => n.id === "union:a|b|c")).toBe(true);
    expect(tree.lines.find((l) => l.source === "d")?.style).toBe("adoptive");
    noOverlap(tree);
  });

  it("stays sane when relatives marry across generations", () => {
    const rels = [parent("gp", "p"), parent("p", "me"), spouse("gp", "me")];
    const tree = layoutFamily("me", rels, {});
    expect(tree.nodes.filter((n) => n.kind === "person")).toHaveLength(3);
    noOverlap(tree);
  });
});
