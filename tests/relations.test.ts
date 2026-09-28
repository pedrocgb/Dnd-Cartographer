import { describe, expect, it } from "vitest";
import { ARTICLE_TEMPLATE_KEYS } from "../src/server/articles/templates";
import { labelFor, pairKeyOf, perspectiveOptions, RELATION_TYPES, relationType } from "../src/server/relations/types";
import { validateRelation, type ExistingRelation } from "../src/server/relations/validate";

const people = { from: "character", to: "character" } as const;

describe("relation type registry", () => {
  it("has unique keys, valid endpoints and colors", () => {
    expect(new Set(RELATION_TYPES.map((t) => t.key)).size).toBe(RELATION_TYPES.length);
    for (const t of RELATION_TYPES) {
      expect(t.color).toMatch(/^#[0-9A-F]{6}$/);
      for (const end of [t.endpoints.from, t.endpoints.to]) {
        if (end !== "*") for (const tpl of end) expect(ARTICLE_TEMPLATE_KEYS).toContain(tpl);
      }
      if (t.symmetric) expect(t.inverseLabel).toBe(t.label);
    }
  });

  it("keys symmetric pairs the same from both ends", () => {
    const ally = relationType("ally")!;
    const parent = relationType("parent")!;
    expect(pairKeyOf(ally, "b", "a")).toBe(pairKeyOf(ally, "a", "b"));
    expect(pairKeyOf(parent, "b", "a")).not.toBe(pairKeyOf(parent, "a", "b"));
  });

  it("reads each end with its own label", () => {
    const rel = { type: "parent", fromId: "anna", toId: "bran" };
    expect(labelFor(rel, "anna")).toBe("Parent of");
    expect(labelFor(rel, "bran")).toBe("Child of");
    expect(labelFor({ type: "custom", fromId: "a", toId: "b", label: "Owes a debt to" }, "b")).toBe("Owes a debt to");
  });

  it("offers both phrasings of directed types between people, and no family ties with a settlement", () => {
    const between = perspectiveOptions("character", "character").map((o) => o.label);
    expect(between).toEqual(expect.arrayContaining(["Parent of", "Child of", "Spouse of", "Mentor of", "Student of"]));
    const withPlace = perspectiveOptions("character", "settlement").map((o) => o.type);
    expect(withPlace).not.toContain("parent");
    expect(withPlace).toEqual(expect.arrayContaining(["leads", "patron", "custom"]));
  });
});

describe("validateRelation", () => {
  const parent = (id: string, fromId: string, toId: string): ExistingRelation => ({ id, type: "parent", fromId, toId, pairKey: `${fromId}|${toId}` });

  it("normalizes a valid relation with its type's defaults", () => {
    const r = validateRelation({ type: "parent", fromId: "a", toId: "b", attitude: 2.4, spouseStatus: "married" }, people, []);
    expect(r).toMatchObject({ ok: true, value: { parentKind: "biological", spouseStatus: null, attitude: 2, pairKey: "a|b" } });
  });

  it("rejects self ties, wrong endpoints and custom ties without a label", () => {
    expect(validateRelation({ type: "ally", fromId: "a", toId: "a" }, people, []).ok).toBe(false);
    expect(validateRelation({ type: "parent", fromId: "a", toId: "b" }, { from: "character", to: "settlement" }, []).ok).toBe(false);
    expect(validateRelation({ type: "custom", fromId: "a", toId: "b" }, people, []).ok).toBe(false);
    expect(validateRelation({ type: "nope", fromId: "a", toId: "b" }, people, []).ok).toBe(false);
  });

  it("rejects duplicates (either direction for symmetric types) but not when editing the same row", () => {
    const existing = [{ id: "r1", type: "ally", fromId: "a", toId: "b", pairKey: "a|b" }];
    expect(validateRelation({ type: "ally", fromId: "b", toId: "a" }, people, existing).ok).toBe(false);
    expect(validateRelation({ type: "ally", fromId: "a", toId: "b" }, people, existing, "r1").ok).toBe(true);
    expect(validateRelation({ type: "rival", fromId: "a", toId: "b" }, people, existing).ok).toBe(true);
  });

  it("rejects ancestry loops but allows any number of parents", () => {
    const existing = [parent("1", "a", "b"), parent("2", "b", "c")];
    expect(validateRelation({ type: "parent", fromId: "c", toId: "a" }, people, existing).ok).toBe(false);
    const threeParents = [parent("1", "p1", "k"), parent("2", "p2", "k")];
    expect(validateRelation({ type: "parent", fromId: "p3", toId: "k" }, people, threeParents).ok).toBe(true);
  });

  it("rejects out-of-range attitudes and spans that end before they start", () => {
    expect(validateRelation({ type: "ally", fromId: "a", toId: "b", attitude: 5 }, people, []).ok).toBe(false);
    expect(validateRelation({ type: "ally", fromId: "a", toId: "b", sinceDay: 10, untilDay: 3 }, people, []).ok).toBe(false);
  });
});
