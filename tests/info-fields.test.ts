import { describe, it, expect } from "vitest";
import { MAX_INFO_TEXT_LENGTH, addedInfo, columnPatch, sanitizeInfo } from "../src/server/articles/info-fields";
import { CHARACTER_INFO, INFO_FIELD_SETS, ORGANIZATION_INFO, TERRITORY_INFO, TITLE_INFO } from "../src/server/articles/info-sets";
import { ARTICLE_TEMPLATE_GROUPS, ARTICLE_TEMPLATE_KEYS, isArticleTemplate } from "../src/server/articles/templates";

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
        if (f.kind === "link") expect(f.link?.targets.every(isArticleTemplate), f.key).toBe(true);
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
    expect(sanitizeInfo(CHARACTER_INFO, { organizations: ["a", "b", "a", 3, ""] })).toEqual({ organizations: ["a", "b"] });
    expect(sanitizeInfo(CHARACTER_INFO, { organizations: "a" })).toEqual({ organizations: [] });
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
    expect(addedInfo(CHARACTER_INFO, person)).toEqual({ nickname: "Red", house: "org-1", status: null });
  });

  it("always includes required fields", () => {
    expect(addedInfo(ORGANIZATION_INFO, { info: "{}", kind: "Guild" })).toEqual({ organizationType: "Guild" });
  });

  it("keeps the user's order: required first, then stored order, then legacy columns", () => {
    const org = { info: JSON.stringify({ status: "Active", motto: "x", foundedOn: null }), kind: "Guild" };
    expect(Object.keys(addedInfo(ORGANIZATION_INFO, org))).toEqual(["organizationType", "status", "motto", "foundedOn"]);
    const person = { info: JSON.stringify({ nickname: "Red" }), houseId: "org-1", status: null };
    expect(Object.keys(addedInfo(CHARACTER_INFO, person))).toEqual(["nickname", "house"]);
  });

  it("treats bad JSON as nothing added", () => {
    expect(addedInfo(CHARACTER_INFO, { info: "{", houseId: null, status: null })).toEqual({});
  });
});

describe("columnPatch", () => {
  it("sends each column field's value, clearing removed ones", () => {
    expect(columnPatch(CHARACTER_INFO, { house: "org-1" })).toEqual({ houseId: "org-1", status: null });
    expect(columnPatch(ORGANIZATION_INFO, { organizationType: "Guild", motto: "x" })).toEqual({ kind: "Guild" });
  });
});
