import { describe, it, expect } from "vitest";
import {
  DEFAULT_HIERARCHY_LEVELS,
  validateChain,
  computeMissingRequiredTypes,
  isValidRootType,
  isValidParentType,
  isAttachableType,
  type TerritoryLike,
} from "../src/server/politics/hierarchy-config";

const DEFAULT_PROFILE_ID = "default-profile";

function levelsMap(overrides?: { [profileId: string]: typeof DEFAULT_HIERARCHY_LEVELS }) {
  const map = new Map<string, typeof DEFAULT_HIERARCHY_LEVELS>();
  map.set(DEFAULT_PROFILE_ID, DEFAULT_HIERARCHY_LEVELS);
  if (overrides) for (const [id, levels] of Object.entries(overrides)) map.set(id, levels);
  return map;
}

function territory(overrides: Partial<TerritoryLike>): TerritoryLike {
  return { id: overrides.id ?? "t", type: overrides.type ?? "Kingdom", parentId: overrides.parentId ?? null, hierarchyProfileId: overrides.hierarchyProfileId ?? DEFAULT_PROFILE_ID };
}

describe("default hierarchy profile", () => {
  it("permits an independent kingdom as a root without an empire", () => {
    expect(isValidRootType("Kingdom", DEFAULT_HIERARCHY_LEVELS)).toBe(true);
  });

  it("permits an empire as a root, with kingdoms underneath it", () => {
    expect(isValidRootType("Empire", DEFAULT_HIERARCHY_LEVELS)).toBe(true);
    expect(isValidParentType("Empire", "Kingdom", DEFAULT_HIERARCHY_LEVELS)).toBe(true);
  });

  it("does not permit a Duchy as a root", () => {
    expect(isValidRootType("Duchy", DEFAULT_HIERARCHY_LEVELS)).toBe(false);
  });

  it("requires Kingdom -> Duchy -> County for an ordinary settlement", () => {
    expect(isValidParentType("Kingdom", "Duchy", DEFAULT_HIERARCHY_LEVELS)).toBe(true);
    expect(isValidParentType("Duchy", "County", DEFAULT_HIERARCHY_LEVELS)).toBe(true);
    // A Duchy cannot be skipped: County's only allowed parent is Duchy.
    expect(isValidParentType("Kingdom", "County", DEFAULT_HIERARCHY_LEVELS)).toBe(false);
  });

  it("permits attachment to a county directly or to its barony", () => {
    expect(isAttachableType("County", DEFAULT_HIERARCHY_LEVELS)).toBe(true);
    expect(isAttachableType("Barony", DEFAULT_HIERARCHY_LEVELS)).toBe(true);
  });

  it("does not permit attachment directly to a Duchy or Kingdom", () => {
    expect(isAttachableType("Duchy", DEFAULT_HIERARCHY_LEVELS)).toBe(false);
    expect(isAttachableType("Kingdom", DEFAULT_HIERARCHY_LEVELS)).toBe(false);
  });

  it("treats a kingdom-only chain as incomplete (missing Duchy and County)", () => {
    const chain = [territory({ id: "k1", type: "Kingdom" })];
    const missing = computeMissingRequiredTypes(chain, levelsMap());
    expect(missing).toEqual(expect.arrayContaining(["Duchy", "County"]));
  });

  it("treats a complete Kingdom->Duchy->County chain as having no missing levels", () => {
    const chain = [
      territory({ id: "k1", type: "Kingdom" }),
      territory({ id: "d1", type: "Duchy", parentId: "k1" }),
      territory({ id: "c1", type: "County", parentId: "d1" }),
    ];
    expect(computeMissingRequiredTypes(chain, levelsMap())).toEqual([]);
  });

  it("does not require a Barony or Empire to be complete", () => {
    const chain = [
      territory({ id: "k1", type: "Kingdom" }),
      territory({ id: "d1", type: "Duchy", parentId: "k1" }),
      territory({ id: "c1", type: "County", parentId: "d1" }),
    ];
    expect(computeMissingRequiredTypes(chain, levelsMap())).not.toContain("Empire");
    expect(computeMissingRequiredTypes(chain, levelsMap())).not.toContain("Barony");
  });
});

describe("validateChain", () => {
  it("accepts a valid full chain", () => {
    const chain = [
      territory({ id: "e1", type: "Empire" }),
      territory({ id: "k1", type: "Kingdom", parentId: "e1" }),
      territory({ id: "d1", type: "Duchy", parentId: "k1" }),
      territory({ id: "c1", type: "County", parentId: "d1" }),
      territory({ id: "b1", type: "Barony", parentId: "c1" }),
    ];
    expect(validateChain(chain, levelsMap()).valid).toBe(true);
  });

  it("rejects an invalid root type", () => {
    const chain = [territory({ id: "d1", type: "Duchy" })];
    const result = validateChain(chain, levelsMap());
    expect(result.valid).toBe(false);
  });

  it("rejects a mismatched parent/child edge", () => {
    const chain = [territory({ id: "k1", type: "Kingdom" }), territory({ id: "b1", type: "Barony", parentId: "k1" })];
    const result = validateChain(chain, levelsMap());
    expect(result.valid).toBe(false);
  });

  it("rejects a cycle", () => {
    const chain = [
      territory({ id: "a", type: "Kingdom" }),
      territory({ id: "b", type: "Duchy", parentId: "a" }),
      territory({ id: "a", type: "Kingdom", parentId: "b" }), // "a" appears twice
    ];
    const result = validateChain(chain, levelsMap());
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/cycle/i);
  });

  it("accepts an empty chain (unassigned marker) as trivially valid", () => {
    expect(validateChain([], levelsMap()).valid).toBe(true);
  });
});

describe("explicit alternative profiles / exceptional branches", () => {
  it("supports a Free Imperial City attaching directly to an Empire, skipping Kingdom", () => {
    const customLevels = [
      { type: "Empire", canBeRoot: true, required: false, attachable: false, allowedParentTypes: [] },
      { type: "Free Imperial City", canBeRoot: false, required: false, attachable: true, allowedParentTypes: ["Empire"] },
    ];
    const map = levelsMap({ "custom-profile": customLevels });
    const chain = [
      territory({ id: "e1", type: "Empire" }),
      territory({ id: "fic1", type: "Free Imperial City", parentId: "e1", hierarchyProfileId: "custom-profile" }),
    ];
    expect(validateChain(chain, map).valid).toBe(true);
    expect(isAttachableType("Free Imperial City", customLevels)).toBe(true);
  });

  it("supports an independent city-state as its own root under a custom profile", () => {
    const customLevels = [{ type: "City-State", canBeRoot: true, required: false, attachable: true, allowedParentTypes: [] }];
    const map = levelsMap({ "city-state-profile": customLevels });
    const chain = [territory({ id: "cs1", type: "City-State", hierarchyProfileId: "city-state-profile" })];
    expect(validateChain(chain, map).valid).toBe(true);
  });

  it("a subordinate kingdom can configure its own internal profile independent of its parent empire's profile", () => {
    // The empire uses the default profile; the kingdom beneath it declares
    // a custom profile for its own duchies (e.g. renaming Duchy -> Province).
    const kingdomProfile = [
      { type: "Kingdom", canBeRoot: true, required: true, attachable: false, allowedParentTypes: ["Empire"] },
      { type: "Province", canBeRoot: false, required: true, attachable: true, allowedParentTypes: ["Kingdom"] },
    ];
    const map = levelsMap({ "kingdom-profile": kingdomProfile });
    const chain = [
      territory({ id: "e1", type: "Empire" }), // default profile
      territory({ id: "k1", type: "Kingdom", parentId: "e1", hierarchyProfileId: "kingdom-profile" }),
      territory({ id: "p1", type: "Province", parentId: "k1", hierarchyProfileId: "kingdom-profile" }),
    ];
    expect(validateChain(chain, map).valid).toBe(true);
  });
});
