import { describe, expect, it } from "vitest";
import { buildCatalog, derivedEdges, derivedSiblings, neighborhood, webEdges, type GraphInput, type GraphRelation } from "../src/server/relations/graph";
import { forceLayout, radialLayout } from "../src/server/relations/layout";

const input: GraphInput = {
  people: [
    { id: "anna", name: "Anna", kind: "npc", houseId: "varn", portraitKey: null, info: "{}" },
    { id: "bran", name: "Bran", kind: "npc", houseId: null, portraitKey: null, info: JSON.stringify({ birthplace: "town" }) },
    { id: "cara", name: "Cara", kind: "player", houseId: null, portraitKey: null, info: "{}" },
  ],
  organizations: [{ id: "varn", name: "House Varn", kind: "Noble House", color: "#AA0000", portraitKey: null, info: "{}" }],
  territories: [
    { id: "realm", name: "Realm", parentId: null, portraitKey: null, info: "{}" },
    { id: "duchy", name: "Duchy", parentId: "realm", portraitKey: null, info: "{}" },
  ],
  articles: [{ id: "town", title: "Town", template: "settlement", portraitKey: null, info: "{}" }],
};

const rel = (id: string, type: string, fromId: string, toId: string, extra: Partial<GraphRelation> = {}): GraphRelation => ({
  id, type, fromId, toId, label: "", oneWay: false, secret: false, pinned: false, attitude: null, parentKind: null, spouseStatus: null, sinceDay: null, untilDay: null, ...extra,
});

describe("relationship graph", () => {
  const catalog = buildCatalog(input);

  it("gives characters their house's color", () => {
    expect(catalog.get("anna")?.color).toBe("#AA0000");
    expect(catalog.get("cara")?.template).toBe("playerCharacter");
  });

  it("derives house, territory and plain-link edges, dropping unknown ends", () => {
    const derived = derivedEdges(catalog, [{ kind: "rules", fromId: "anna", toId: "ghost", label: "Count" }], input);
    expect(derived.map((d) => d.kind).sort()).toEqual(["house", "linked", "territoryParent"]);
  });

  it("filters secrets, groups, dates and hides derived edges a relation already covers", () => {
    const derived = derivedEdges(catalog, [], input);
    const relations = [
      rel("r1", "ally", "anna", "varn"),
      rel("r2", "enemy", "anna", "bran", { secret: true }),
      rel("r3", "parent", "anna", "cara", { sinceDay: 10, untilDay: 20 }),
    ];
    const all = webEdges(catalog, relations, derived, { showLinked: true });
    expect(all.some((e) => e.type === "house")).toBe(false); // anna—varn is already an ally tie
    expect(all.map((e) => e.id)).toEqual(expect.arrayContaining(["r1", "r2", "r3"]));
    expect(webEdges(catalog, relations, derived, { hideSecrets: true }).some((e) => e.id === "r2")).toBe(false);
    expect(webEdges(catalog, relations, derived, { groups: ["family"] }).filter((e) => !e.derived).map((e) => e.id)).toEqual(["r3"]);
    expect(webEdges(catalog, relations, derived, { asOfDay: 30 }).some((e) => e.id === "r3")).toBe(false);
    expect(webEdges(catalog, relations, derived, {}).some((e) => e.type === "linked")).toBe(false);
  });

  it("walks the neighborhood hop by hop", () => {
    const edges = webEdges(catalog, [rel("a", "ally", "anna", "bran"), rel("b", "friend", "bran", "cara")], [], {});
    expect([...neighborhood(edges, "anna", 1)].sort()).toEqual(["anna", "bran"]);
    expect([...neighborhood(edges, "anna", 2)].sort()).toEqual(["anna", "bran", "cara"]);
  });

  it("finds full and half siblings from shared parents", () => {
    const relations = [rel("1", "parent", "p", "a"), rel("2", "parent", "q", "a"), rel("3", "parent", "p", "b"), rel("4", "parent", "q", "b"), rel("5", "parent", "p", "c")];
    expect(derivedSiblings(relations, "a")).toEqual([{ id: "b", full: true }, { id: "c", full: false }]);
  });
});

describe("layouts", () => {
  const edges = [{ fromId: "a", toId: "b" }, { fromId: "b", toId: "c" }, { fromId: "a", toId: "d" }];

  it("puts the focus in the middle and hops on rings", () => {
    const at = radialLayout("a", ["a", "b", "c", "d"], edges);
    expect(at.a).toEqual({ x: 0, y: 0 });
    const r = (id: string) => Math.hypot(at[id].x, at[id].y);
    expect(r("c")).toBeGreaterThan(r("b"));
  });

  it("is deterministic and keeps cards apart", () => {
    const ids = ["a", "b", "c", "d", "e"];
    const one = forceLayout(ids, edges, 100);
    expect(forceLayout(ids, edges, 100)).toEqual(one);
    for (const x of ids) for (const y of ids) if (x < y) expect(Math.hypot(one[x].x - one[y].x, one[x].y - one[y].y)).toBeGreaterThan(40);
  });
});
