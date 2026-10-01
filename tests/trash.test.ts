import { describe, expect, it } from "vitest";
import { countByGroup, daysUntilPurge, filterSortTrash, parseTrashRefs, trashedDescendants, trashedMapRoots, type TrashItem } from "../src/server/trash/trash";
import { filterShortcutGroups, SHORTCUT_GROUPS, SHORTCUT_KEYS } from "../src/components/shortcuts";

const item = (over: Partial<TrashItem>): TrashItem => ({ kind: "article", id: "x", name: "X", subtype: "Item", deletedAt: 0, childCount: 0, campaignCount: 0, ...over });

const items = [
  item({ kind: "map", id: "m1", name: "Sword Coast", subtype: "Map", deletedAt: 300 }),
  item({ kind: "person", id: "p1", name: "anna", subtype: "Character", deletedAt: 100 }),
  item({ kind: "calendarEntry", id: "e1", name: "Harvest Feast", subtype: "Calendar event", deletedAt: 200 }),
  item({ kind: "article", id: "a1", name: "Blackstaff", subtype: "Item", deletedAt: 200 }),
];

describe("trash list", () => {
  it("sorts by deletion date, newest first by default", () => {
    expect(filterSortTrash(items).map((i) => i.id)).toEqual(["m1", "a1", "e1", "p1"]);
    expect(filterSortTrash(items, { sort: "deleted", dir: "asc" }).map((i) => i.id)).toEqual(["p1", "a1", "e1", "m1"]);
  });

  it("sorts by name ignoring case, and by type", () => {
    expect(filterSortTrash(items, { sort: "name" }).map((i) => i.name)).toEqual(["anna", "Blackstaff", "Harvest Feast", "Sword Coast"]);
    expect(filterSortTrash(items, { sort: "type" }).map((i) => i.subtype)).toEqual(["Calendar event", "Character", "Item", "Map"]);
  });

  it("filters by tab and searches names and types", () => {
    expect(filterSortTrash(items, { group: "articles" }).map((i) => i.id)).toEqual(["a1", "p1"]);
    expect(filterSortTrash(items, { q: "FEAST" }).map((i) => i.id)).toEqual(["e1"]);
    expect(filterSortTrash(items, { q: "character" }).map((i) => i.id)).toEqual(["p1"]);
    expect(countByGroup(items)).toEqual({ all: 4, maps: 1, articles: 2, calendar: 1 });
  });

  it("files trashed calendars under the Calendar tab with their entries", () => {
    const withCalendar = [...items, item({ kind: "calendar", id: "c1", name: "Harptos", subtype: "Calendar", deletedAt: 50 })];
    expect(filterSortTrash(withCalendar, { group: "calendar" }).map((i) => i.id)).toEqual(["e1", "c1"]);
    expect(countByGroup(withCalendar).calendar).toBe(2);
  });

  it("shows trashed maps under their trashed parent, not on their own", () => {
    const maps = [
      { id: "world", parentId: null, deletedAt: 5 },
      { id: "region", parentId: "world", deletedAt: 5 },
      { id: "city", parentId: "region", deletedAt: 9 },
      { id: "live", parentId: null, deletedAt: null },
      { id: "lone", parentId: "live", deletedAt: 7 },
    ];
    expect(trashedMapRoots(maps).map((m) => m.id)).toEqual(["world", "lone"]);
    expect(trashedDescendants(maps, "world").map((m) => m.id)).toEqual(["region", "city"]);
    expect(trashedDescendants(maps, "lone")).toEqual([]);
  });

  it("counts days left before auto-delete", () => {
    const day = 86_400_000;
    expect(daysUntilPurge(0, null, 10 * day)).toBeNull();
    expect(daysUntilPurge(0, 30, 10 * day)).toBe(20);
    expect(daysUntilPurge(0, 7, 10 * day)).toBe(0);
  });

  it("validates request items", () => {
    expect(parseTrashRefs([{ kind: "map", id: "a" }, { kind: "map", id: "a" }])).toEqual([{ kind: "map", id: "a" }]);
    expect(parseTrashRefs([{ kind: "calendar", id: "c" }])).toEqual([{ kind: "calendar", id: "c" }]);
    expect(parseTrashRefs([{ kind: "zone", id: "a" }])).toBeNull();
    expect(parseTrashRefs([])).toBeNull();
    expect(parseTrashRefs("map")).toBeNull();
  });
});

describe("shortcuts reference", () => {
  it("lists every map tool key from the sidebar's own table", () => {
    const tools = SHORTCUT_GROUPS.find((g) => g.title === "Map tools")!;
    expect(tools.shortcuts.map((s) => s.keys[0]).sort()).toEqual(Object.values(SHORTCUT_KEYS).sort());
  });

  it("never repeats a key combo within a group and context", () => {
    for (const group of SHORTCUT_GROUPS) {
      const seen = new Set<string>();
      for (const s of group.shortcuts) {
        for (const combo of s.keys) {
          const key = `${s.context ?? ""}|${combo}|${s.action}`;
          expect(seen.has(key), `${group.title}: ${combo}`).toBe(false);
          seen.add(key);
        }
      }
    }
  });

  it("searches actions, contexts and keys", () => {
    expect(filterShortcutGroups(SHORTCUT_GROUPS, "brush").flatMap((g) => g.shortcuts).length).toBeGreaterThan(0);
    expect(filterShortcutGroups(SHORTCUT_GROUPS, "zzzz-nothing")).toEqual([]);
  });
});
