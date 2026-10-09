import { describe, expect, it } from "vitest";
import { MAX_ARROW_LABEL, MAX_BOARD_ARROWS, MAX_BOARD_CARDS, MAX_GROUP_TITLE, NOTE_MAX_H, NOTE_MAX_W, NOTE_MIN_H, NOTE_MIN_W, parseBoardJson, sanitizeBoardArrows, sanitizeBoardCards, sanitizeBoardGroups, sanitizeBoardFilters, sanitizeBoardName } from "../src/server/relations/boards";

describe("relationship boards", () => {
  it("trims names and rejects empty ones", () => {
    expect(sanitizeBoardName("  Court of Damara ")).toBe("Court of Damara");
    expect(sanitizeBoardName("   ")).toBeNull();
    expect(sanitizeBoardName(3)).toBeNull();
  });

  it("keeps one card per id, rounds coordinates and only gives notes text and color", () => {
    const cards = sanitizeBoardCards([
      { id: "a", x: 10.6, y: "x", text: "ignored" },
      { id: "a", x: 0, y: 0 },
      { id: "note:1", x: 1, y: 2, text: "Who poisoned the king?", color: "#FACC15" },
      { id: "note:2", x: 1, y: 2, color: "red" },
      { id: "" },
      null,
    ]);
    expect(cards).toEqual([
      { id: "a", x: 11, y: 0 },
      { id: "note:1", x: 1, y: 2, text: "Who poisoned the king?", color: "#facc15" },
      { id: "note:2", x: 1, y: 2, text: "" },
    ]);
    expect(sanitizeBoardCards({})).toBeNull();
  });

  it("keeps a note's size within bounds, and only on notes", () => {
    const cards = sanitizeBoardCards([
      { id: "note:1", x: 0, y: 0, w: 250.4, h: 130.6 },
      { id: "note:2", x: 0, y: 0, w: 10, h: 99999 },
      { id: "note:3", x: 0, y: 0, w: 99999, h: 1 },
      { id: "note:4", x: 0, y: 0, w: "wide", h: Number.NaN },
      { id: "a", x: 0, y: 0, w: 300, h: 200 },
    ]);
    expect(cards?.map(({ w, h }) => ({ w, h }))).toEqual([
      { w: 250, h: 131 },
      { w: NOTE_MIN_W, h: NOTE_MAX_H },
      { w: NOTE_MAX_W, h: NOTE_MIN_H },
      { w: undefined, h: undefined },
      { w: undefined, h: undefined },
    ]);
  });

  it("keeps known arrow shapes, one per pair of cards", () => {
    const arrows = sanitizeBoardArrows([
      { id: "1", from: "a", to: "b", label: "  leads to  ", dir: "both", color: "#F87171", dashed: true },
      { id: "2", from: "b", to: "a" },
      { id: "1", from: "a", to: "c" },
      { id: "3", from: "a", to: "a" },
      { id: "4", from: "a", to: "c", label: "x".repeat(200), dir: "sideways", color: "red", dashed: "yes" },
      { id: "5", from: "", to: "c" },
      "junk",
    ]);
    expect(arrows).toEqual([
      { id: "1", from: "a", to: "b", label: "leads to", dir: "both", color: "#f87171", dashed: true },
      { id: "4", from: "a", to: "c", label: "x".repeat(MAX_ARROW_LABEL) },
    ]);
    expect(sanitizeBoardArrows("nope")).toBeNull();
    expect(parseBoardJson("{", sanitizeBoardArrows, [])).toEqual([]);
  });

  it("keeps an arrow's pinned sides only when valid", () => {
    expect(sanitizeBoardArrows([{ id: "1", from: "a", to: "b", fromSide: "r", toSide: "l" }, { id: "2", from: "a", to: "c", fromSide: "middle", toSide: 3 }])).toEqual([
      { id: "1", from: "a", to: "b", fromSide: "r", toSide: "l" },
      { id: "2", from: "a", to: "c" },
    ]);
  });

  it("keeps each card in one group and drops empty groups", () => {
    const groups = sanitizeBoardGroups([
      { id: "g1", title: "  Villains  ", members: ["a", "b", "a", 3] },
      { id: "g2", title: "y".repeat(100), members: ["b", "c"] },
      { id: "g3", title: "Empty", members: ["a"] },
      { id: "g1", title: "Dupe", members: ["d"] },
      { id: "g4", members: "nope" },
    ]);
    expect(groups).toEqual([
      { id: "g1", title: "Villains", members: ["a", "b"] },
      { id: "g2", title: "y".repeat(MAX_GROUP_TITLE), members: ["c"] },
    ]);
    expect(sanitizeBoardGroups({})).toBeNull();
  });

  it("caps the number of arrows", () => {
    const many = Array.from({ length: MAX_BOARD_ARROWS + 5 }, (_, i) => ({ id: `a${i}`, from: `x${i}`, to: `y${i}` }));
    expect(sanitizeBoardArrows(many)).toHaveLength(MAX_BOARD_ARROWS);
  });

  it("caps the number of cards", () => {
    const many = Array.from({ length: MAX_BOARD_CARDS + 5 }, (_, i) => ({ id: `r${i}`, x: 0, y: 0 }));
    expect(sanitizeBoardCards(many)).toHaveLength(MAX_BOARD_CARDS);
  });

  it("keeps known filters only", () => {
    expect(sanitizeBoardFilters({ groups: ["family", "nope", "family"], showDerived: true, attitudeMode: "yes", extra: 1 })).toEqual({ groups: ["family"], showDerived: true });
    expect(sanitizeBoardFilters([])).toBeNull();
  });

  it("falls back on unreadable stored JSON", () => {
    expect(parseBoardJson("not json", sanitizeBoardCards, [])).toEqual([]);
    expect(parseBoardJson('[{"id":"a","x":1,"y":2}]', sanitizeBoardCards, [])).toEqual([{ id: "a", x: 1, y: 2 }]);
  });
});
