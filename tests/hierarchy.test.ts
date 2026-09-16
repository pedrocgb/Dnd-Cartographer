import { describe, it, expect } from "vitest";
import { validateReparent, InvalidReparentError, type MapNode } from "../src/server/maps/hierarchy";

const worldA = "world-a";
const worldB = "world-b";

function nodes(...overrides: Partial<MapNode>[]): MapNode[] {
  return overrides.map((o, i) => ({
    id: o.id ?? `m${i}`,
    worldId: o.worldId ?? worldA,
    parentId: o.parentId ?? null,
  }));
}

describe("validateReparent", () => {
  it("allows a valid reparent within the same world", () => {
    const maps = nodes({ id: "root" }, { id: "child" }, { id: "grandchild" });
    expect(() => validateReparent(maps, "grandchild", "child")).not.toThrow();
  });

  it("allows clearing a parent (making a map a root)", () => {
    const maps = nodes({ id: "root" }, { id: "child", parentId: "root" });
    expect(() => validateReparent(maps, "child", null)).not.toThrow();
  });

  it("rejects a map becoming its own parent", () => {
    const maps = nodes({ id: "a" });
    expect(() => validateReparent(maps, "a", "a")).toThrow(InvalidReparentError);
  });

  it("rejects a direct cycle (parent becomes child of its own child)", () => {
    const maps = nodes({ id: "root" }, { id: "child", parentId: "root" });
    expect(() => validateReparent(maps, "root", "child")).toThrow(InvalidReparentError);
  });

  it("rejects a deep cycle", () => {
    const maps = nodes(
      { id: "a" },
      { id: "b", parentId: "a" },
      { id: "c", parentId: "b" },
      { id: "d", parentId: "c" }
    );
    expect(() => validateReparent(maps, "a", "d")).toThrow(InvalidReparentError);
  });

  it("rejects cross-world reparenting", () => {
    const maps = nodes({ id: "a", worldId: worldA }, { id: "b", worldId: worldB });
    expect(() => validateReparent(maps, "a", "b")).toThrow(InvalidReparentError);
  });

  it("rejects an unknown parent id", () => {
    const maps = nodes({ id: "a" });
    expect(() => validateReparent(maps, "a", "does-not-exist")).toThrow(InvalidReparentError);
  });
});
