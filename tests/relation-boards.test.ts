import { describe, expect, it } from "vitest";
import { MAX_BOARD_CARDS, parseBoardJson, sanitizeBoardCards, sanitizeBoardFilters, sanitizeBoardName } from "../src/server/relations/boards";

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
