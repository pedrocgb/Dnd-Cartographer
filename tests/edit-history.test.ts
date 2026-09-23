import { describe, expect, it } from "vitest";
import { COALESCE_MS, EMPTY_HISTORY, HISTORY_LIMIT, pushEntry, takeRedo, takeUndo, type EditEntry } from "../src/components/edit-history";

function entry(label: string, at: number, key?: string): EditEntry {
  return { label, at, key, undo: () => `undo ${label}`, redo: () => `redo ${label}` };
}

describe("edit history", () => {
  it("keeps only the last HISTORY_LIMIT edits", () => {
    let s = EMPTY_HISTORY;
    for (let i = 0; i < HISTORY_LIMIT + 3; i++) s = pushEntry(s, entry(`e${i}`, i * 10_000));
    expect(s.past).toHaveLength(HISTORY_LIMIT);
    expect(s.past[0].label).toBe("e3");
  });

  it("moves entries between undo and redo stacks", () => {
    let s = pushEntry(pushEntry(EMPTY_HISTORY, entry("a", 0)), entry("b", 10_000));
    const u = takeUndo(s)!;
    expect(u.entry.label).toBe("b");
    s = u.state;
    expect(s.future.map((e) => e.label)).toEqual(["b"]);
    const r = takeRedo(s)!;
    expect(r.entry.label).toBe("b");
    expect(r.state.past.map((e) => e.label)).toEqual(["a", "b"]);
    expect(takeRedo(r.state)).toBeNull();
  });

  it("clears the redo stack on a new edit", () => {
    const s = takeUndo(pushEntry(EMPTY_HISTORY, entry("a", 0)))!.state;
    expect(pushEntry(s, entry("b", 1)).future).toEqual([]);
  });

  it("merges same-key edits close together, keeping the first undo", () => {
    let s = pushEntry(EMPTY_HISTORY, entry("drag1", 0, "k"));
    s = pushEntry(s, entry("drag2", COALESCE_MS - 1, "k"));
    s = pushEntry(s, entry("drag3", 2 * COALESCE_MS - 2, "k"));
    expect(s.past).toHaveLength(1);
    expect(s.past[0].undo()).toBe("undo drag1");
    expect(s.past[0].redo()).toBe("redo drag3");
  });

  it("does not merge different keys, late edits, or after a redo", () => {
    let s = pushEntry(EMPTY_HISTORY, entry("a", 0, "k"));
    expect(pushEntry(s, entry("b", 1, "other")).past).toHaveLength(2);
    expect(pushEntry(s, entry("b", COALESCE_MS + 1, "k")).past).toHaveLength(2);
    s = takeRedo(takeUndo(s)!.state)!.state;
    expect(pushEntry(s, entry("b", 1, "k")).past).toHaveLength(2);
  });
});
