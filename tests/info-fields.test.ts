import { describe, it, expect } from "vitest";
import { MAX_INFO_TEXT_LENGTH, addedInfo, columnPatch, defineFieldSet, emptyRequiredInfo, sanitizeColor, sanitizeInfo } from "../src/server/articles/info-fields";
import { CHARACTER_INFO, INFO_FIELD_SETS, ORGANIZATION_INFO, PLAYER_CHARACTER_INFO, TERRITORY_INFO, TITLE_INFO, personInfoSet } from "../src/server/articles/info-sets";
import { ARTICLE_TEMPLATE_GROUPS, ARTICLE_TEMPLATE_KEYS, isArticleTemplate, type ArticleTemplateKey } from "../src/server/articles/templates";
import { relationFieldValues } from "../src/server/relations/info-backing";
import { allows, relationType } from "../src/server/relations/types";

describe("ARTICLE_TEMPLATE_GROUPS", () => {
  it("lists every template once, in ARTICLE_TEMPLATE_KEYS order", () => {
    expect(ARTICLE_TEMPLATE_GROUPS.flat()).toEqual([...ARTICLE_TEMPLATE_KEYS]);
  });

  it("gives every template a field set", () => {
    expect(ARTICLE_TEMPLATE_KEYS.filter((k) => !INFO_FIELD_SETS[k])).toEqual([]);
  });
});

describe("INFO_FIELD_SETS", () => {
  for (const [template, set] of Object.entries(INFO_FIELD_SETS)) {
    it(`${template}: unique keys, alphabetical folders, hints, valid kinds`, () => {
      const keys = set!.fields.map((f) => f.key);
      expect(new Set(keys).size).toBe(keys.length);
      for (const g of set!.groups) {
        const labels = set!.fields.filter((f) => f.group === g.key).map((f) => f.label);
        expect(labels.length, g.key).toBeGreaterThan(0);
        expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
      }
      for (const f of set!.fields) {
        expect(set!.groups.some((g) => g.key === f.group), f.key).toBe(true);
        expect(f.hint.length, f.key).toBeGreaterThan(0);
        if (f.kind === "link") expect(f.link?.targets.every((t) => isArticleTemplate(t) || t === "seasonProfile"), f.key).toBe(true);
        if (f.kind === "select") {
          expect(f.options?.length, f.key).toBeGreaterThan(0);
          expect(new Set(f.options).size, f.key).toBe(f.options!.length);
        }
      }
    });
  }
});

describe("sanitizeInfo", () => {
  it("returns null when info isn't an object", () => {
    expect(sanitizeInfo(CHARACTER_INFO, undefined)).toBeNull();
    expect(sanitizeInfo(CHARACTER_INFO, "x")).toBeNull();
    expect(sanitizeInfo(CHARACTER_INFO, [])).toBeNull();
  });

  it("keeps the client's key order", () => {
    expect(Object.keys(sanitizeInfo(CHARACTER_INFO, { siblings: [], age: "3", bogus: 1, alignment: null })!)).toEqual(["siblings", "age", "alignment"]);
  });

  it("drops unknown keys", () => {
    expect(sanitizeInfo(CHARACTER_INFO, { nickname: "Red", bogus: "x" })).toEqual({ nickname: "Red" });
  });

  it("trims and caps text, keeping an empty added field as null", () => {
    const out = sanitizeInfo(CHARACTER_INFO, { hair: `  ${"a".repeat(300)}  `, eyes: "   " })!;
    expect(out.hair).toHaveLength(MAX_INFO_TEXT_LENGTH);
    expect(out).toHaveProperty("eyes", null);
  });

  it("rejects select values outside the options", () => {
    expect(sanitizeInfo(CHARACTER_INFO, { alignment: "Chaotic Good" })).toEqual({ alignment: "Chaotic Good" });
    expect(sanitizeInfo(CHARACTER_INFO, { alignment: "Very Evil" })).toEqual({ alignment: null });
    expect(sanitizeInfo(CHARACTER_INFO, { socialBackground: "Lords’ Alliance Vassal" })).toEqual({ socialBackground: "Lords’ Alliance Vassal" });
  });

  it("filters and dedupes multi-select values", () => {
    expect(sanitizeInfo(TITLE_INFO, { titleType: ["Noble", "Bogus", "Noble", 3] })).toEqual({ titleType: ["Noble"] });
    expect(sanitizeInfo(TITLE_INFO, { titleType: "Noble" })).toEqual({ titleType: [] });
  });

  it("dedupes multi links and drops non-ids", () => {
    expect(sanitizeInfo(CHARACTER_INFO, { culture: ["a", "b", "a", 3, ""] })).toEqual({ culture: ["a", "b"] });
    expect(sanitizeInfo(CHARACTER_INFO, { culture: "a" })).toEqual({ culture: [] });
    expect(sanitizeInfo(CHARACTER_INFO, { lastSeen: ["a"] })).toEqual({ lastSeen: null });
  });

  it("keeps column fields as bare presence markers", () => {
    expect(sanitizeInfo(CHARACTER_INFO, { house: "org-1", status: "Alive" })).toEqual({ house: null, status: null });
    expect(sanitizeInfo(TERRITORY_INFO, { governmentForm: "Monarchy" })).toEqual({ governmentForm: null });
  });
});

describe("addedInfo", () => {
  it("reads column fields from their columns, others from info", () => {
    const person = { info: JSON.stringify({ nickname: "Red", status: null }), houseId: "org-1", status: null };
    expect(addedInfo(CHARACTER_INFO, person)).toEqual({ status: null, nickname: "Red", house: "org-1" });
  });

  it("always includes required fields", () => {
    expect(addedInfo(ORGANIZATION_INFO, { info: "{}", kind: "Guild" })).toEqual({ organizationType: "Guild", status: null });
  });

  it("keeps the user's order: required first, then stored order, then legacy columns", () => {
    const org = { info: JSON.stringify({ status: "Active", motto: "x", foundedOn: null }), kind: "Guild" };
    expect(Object.keys(addedInfo(ORGANIZATION_INFO, org))).toEqual(["organizationType", "status", "motto", "foundedOn"]);
    const person = { info: JSON.stringify({ nickname: "Red" }), houseId: "org-1", status: null };
    expect(Object.keys(addedInfo(CHARACTER_INFO, person))).toEqual(["status", "nickname", "house"]);
  });

  it("treats bad JSON as nothing added", () => {
    expect(addedInfo(CHARACTER_INFO, { info: "{", houseId: null, status: null })).toEqual({ status: null });
  });
});

describe("columnPatch", () => {
  it("sends each column field's value, clearing removed ones", () => {
    expect(columnPatch(CHARACTER_INFO, { house: "org-1" })).toEqual({ houseId: "org-1", status: null });
    expect(columnPatch(ORGANIZATION_INFO, { organizationType: "Guild", motto: "x" })).toEqual({ kind: "Guild", color: null });
  });
});

describe("required fields", () => {
  it("keeps the listed order and marks each field required", () => {
    expect(INFO_FIELD_SETS.magic!.required).toEqual(["castingMethod", "school", "spellLevelOrRank", "concentration", "components", "status"]);
    for (const set of Object.values(INFO_FIELD_SETS)) {
      for (const key of set!.required) expect(set!.fields.find((f) => f.key === key)?.required).toBe(true);
      expect(set!.fields.filter((f) => f.required).length).toBe(set!.required.length);
    }
  });

  it("puts required fields first in addedInfo, in order, even when absent", () => {
    const values = addedInfo(INFO_FIELD_SETS.species!, { info: JSON.stringify({ diet: "Fish", typicalSize: ["Small"] }) });
    expect(Object.keys(values)).toEqual(["creatureType", "typicalSize", "diet"]);
    expect(values.creatureType).toBeNull();
  });

  it("starts a create form with every required field empty", () => {
    expect(emptyRequiredInfo(INFO_FIELD_SETS.species!)).toEqual({ creatureType: null, typicalSize: [] });
  });

  it("shows an existing territory parent as an added (optional) field", () => {
    const values = addedInfo(TERRITORY_INFO, { info: "{}", governmentForm: null, parentId: "t-1" });
    expect(Object.keys(values)).toEqual(["governmentForm", "parentTerritory"]);
    expect(values.parentTerritory).toBe("t-1");
    expect(TERRITORY_INFO.fields.find((f) => f.key === "parentTerritory")?.required).toBeUndefined();
    expect(Object.keys(addedInfo(TERRITORY_INFO, { info: "{}", governmentForm: null, parentId: null }))).toEqual(["governmentForm"]);
  });

  it("rejects an unknown required key", () => {
    expect(() => defineFieldSet([{ key: "g", label: "G" }], [{ key: "a", label: "A", group: "g", kind: "text", hint: "h" }], ["nope"])).toThrow(/nope/);
  });
});

describe("PLAYER_CHARACTER_INFO", () => {
  it("requires only the Controlling Player", () => {
    expect(PLAYER_CHARACTER_INFO.required).toEqual(["controllingPlayer"]);
    expect(emptyRequiredInfo(PLAYER_CHARACTER_INFO)).toEqual({ controllingPlayer: null });
  });

  it("has every Character field, with Enemies moved to Party Dynamics", () => {
    const keys = new Set(PLAYER_CHARACTER_INFO.fields.map((f) => f.key));
    expect(CHARACTER_INFO.fields.filter((f) => !keys.has(f.key)).map((f) => f.key)).toEqual([]);
    const enemies = PLAYER_CHARACTER_INFO.fields.find((f) => f.key === "enemies")!;
    expect(enemies.group).toBe("party");
    expect(enemies.link?.targets).toEqual(["character", "playerCharacter", "organization"]);
  });

  it("keeps House and Status on their columns", () => {
    const person = { info: JSON.stringify({ controllingPlayer: "Ana" }), houseId: "org-1", status: "Alive" };
    expect(addedInfo(PLAYER_CHARACTER_INFO, person)).toEqual({ controllingPlayer: "Ana", house: "org-1", status: "Alive" });
  });

  it("is picked by the person's kind", () => {
    expect(personInfoSet("player")).toBe(PLAYER_CHARACTER_INFO);
    expect(personInfoSet("npc")).toBe(CHARACTER_INFO);
    expect(personInfoSet(null)).toBe(CHARACTER_INFO);
  });

  it("drops a bad Party Role", () => {
    expect(sanitizeInfo(PLAYER_CHARACTER_INFO, { partyRole: "The Bard" })).toEqual({ partyRole: null });
    expect(sanitizeInfo(PLAYER_CHARACTER_INFO, { partyRole: "The Tank" })).toEqual({ partyRole: "The Tank" });
  });
});

describe("relation-backed fields", () => {
  for (const [template, set] of Object.entries(INFO_FIELD_SETS)) {
    const backed = set!.fields.filter((f) => f.relation);
    if (backed.length === 0) continue;
    it(`${template}: each fits its relation type, and no two share a relation`, () => {
      for (const f of backed) {
        const type = relationType(f.relation!.type);
        expect(type, f.key).toBeDefined();
        expect(f.kind).toBe("link");
        const [self, other] = f.relation!.side === "to" ? [type!.endpoints.to, type!.endpoints.from] : [type!.endpoints.from, type!.endpoints.to];
        expect(allows(self, template as ArticleTemplateKey), f.key).toBe(true);
        for (const target of f.link!.targets) expect(allows(other, target as ArticleTemplateKey), `${f.key} -> ${target}`).toBe(true);
        if (f.relation!.side === "any") expect(type!.symmetric, f.key).toBe(true);
      }
      for (const a of backed) {
        for (const b of backed) {
          if (a === b || a.relation!.type !== b.relation!.type) continue;
          const sidesOverlap = a.relation!.side === "any" || b.relation!.side === "any" || a.relation!.side === b.relation!.side;
          const targetsOverlap = a.link!.targets.some((t) => b.link!.targets.includes(t));
          expect(sidesOverlap && targetsOverlap, `${a.key} / ${b.key}`).toBe(false);
        }
      }
    });
  }

  const templates: Record<string, ArticleTemplateKey> = { anna: "character", bran: "character", guild: "organization", pc: "playerCharacter" };
  const templateOf = (id: string) => templates[id] ?? null;

  it("reads both ends of a tie, one-way ties only from their holder", () => {
    const rels = [
      { type: "parent", fromId: "anna", toId: "bran" },
      { type: "ally", fromId: "guild", toId: "bran" },
      { type: "ally", fromId: "pc", toId: "bran", oneWay: true },
    ];
    expect(relationFieldValues(CHARACTER_INFO, "bran", rels, templateOf)).toMatchObject({ parents: ["anna"], children: [], allies: ["guild"] });
    expect(relationFieldValues(CHARACTER_INFO, "anna", rels, templateOf)).toMatchObject({ children: ["bran"], parents: [] });
    expect(relationFieldValues(PLAYER_CHARACTER_INFO, "pc", rels, templateOf)).toMatchObject({ allies: ["bran"] });
    expect(relationFieldValues(ORGANIZATION_INFO, "guild", rels, templateOf)).toMatchObject({ alliedOrganizations: [] });
  });

  it("stores relation fields as presence markers and shows ties made from the other side", () => {
    expect(sanitizeInfo(CHARACTER_INFO, { parents: ["anna"] })).toEqual({ parents: null });
    const values = addedInfo(CHARACTER_INFO, { info: JSON.stringify({ reputation: "Kind" }) }, { parents: ["anna"], children: [] });
    expect(Object.keys(values).slice(-2)).toEqual(["reputation", "parents"]);
    expect(values.parents).toEqual(["anna"]);
  });
});

describe("color fields", () => {
  it("accept #RRGGBB only, uppercased", () => {
    expect(sanitizeColor(" #a1b2c3 ")).toBe("#A1B2C3");
    expect(sanitizeColor("red")).toBeNull();
    expect(sanitizeColor("#abc")).toBeNull();
  });
});
