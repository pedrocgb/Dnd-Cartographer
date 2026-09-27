import { describe, expect, it } from "vitest";
import { daysToDeadline, questsOnDay } from "../src/server/quests/logic";
import { layoutMap, MAP_COLUMN, MAP_ROW, questMapGraph } from "../src/server/quests/map";
import { parseMapPositions, parseQuestDays } from "../src/server/quests/parse";
import type { FrontData, QuestData } from "../src/server/quests/types";

const quest = (id: string, more: Partial<QuestData> = {}): QuestData => ({
  id,
  campaignId: "camp",
  parentId: null,
  title: id,
  kind: "side",
  status: "active",
  priority: 1,
  summary: "",
  bodyDocumentId: null,
  giver: null,
  articleLinks: [],
  objectives: [],
  frontId: null,
  clues: [],
  clock: null,
  rewards: null,
  startDay: null,
  deadlineDay: null,
  endDay: null,
  sortOrder: 0,
  version: 1,
  ...more,
});

const front = (id: string): FrontData => ({ id, campaignId: "camp", name: id, kind: "campaign", status: "active", threat: "", doom: "", portents: [], clock: null, clockPerPortent: false, color: "#E8735F", sortOrder: 0, version: 1 });

describe("quest dates", () => {
  it("parses days and keeps their order", () => {
    expect(parseQuestDays({ startDay: 10, deadlineDay: 20, endDay: null })).toEqual({ startDay: 10, deadlineDay: 20, endDay: null });
    expect(parseQuestDays({ title: "x" })).toEqual({});
    expect(() => parseQuestDays({ startDay: 10, endDay: 9 })).toThrow(/end before/);
    expect(() => parseQuestDays({ startDay: 10, deadlineDay: 9 })).toThrow(/deadline/);
    expect(() => parseQuestDays({ startDay: 1.5 })).toThrow(/whole number/);
  });

  it("finds the quests dated on a day and counts down to deadlines", () => {
    const list = [quest("a", { startDay: 5, deadlineDay: 5 }), quest("b", { endDay: 5 }), quest("c", { startDay: 6 })];
    expect(questsOnDay(list, 5).map((x) => [x.quest.id, x.kind])).toEqual([
      ["a", "start"],
      ["a", "deadline"],
      ["b", "end"],
    ]);
    expect(daysToDeadline({ deadlineDay: 12 }, 10)).toBe(2);
    expect(daysToDeadline({ deadlineDay: 8 }, 10)).toBe(-2);
    expect(daysToDeadline({ deadlineDay: null }, 10)).toBeNull();
  });
});

describe("quest map", () => {
  it("parses positions to save", () => {
    expect(parseMapPositions({ "q:a": { x: 10.4, y: -3 }, "a:b": null })).toEqual({ "q:a": { x: 10, y: -3 }, "a:b": null });
    expect(() => parseMapPositions({ "q:a": { x: Infinity, y: 0 } })).toThrow(/out of range/);
    expect(() => parseMapPositions([])).toThrow();
  });

  it("builds fronts, quests, sub-quests, clues and articles with their edges", () => {
    const quests = [
      quest("main", { frontId: "f", giver: { template: "character", articleId: "npc" }, articleLinks: [{ template: "territory", articleId: "town", role: "location" }] }),
      quest("sub", { parentId: "main", frontId: "f", clues: [{ id: "c1", text: "A clue", placedIn: [{ template: "character", articleId: "npc" }], revealed: false, revealedSessionId: null }] }),
      quest("lost", { articleLinks: [{ template: "item", articleId: "gone", role: "item" }] }),
    ];
    const names: Record<string, string> = { npc: "Old Tom", town: "Saltmere" };
    const { nodes, edges } = questMapGraph(quests, [front("f"), front("unused")], (r) => names[r.articleId] ?? null);
    expect(nodes.map((n) => [n.id, n.rank])).toEqual([
      ["f:f", 0],
      ["q:main", 1],
      ["q:sub", 2],
      ["c:sub:c1", 3],
      ["q:lost", 1],
      ["a:npc", 4],
      ["a:town", 4],
    ]);
    expect(edges.map((e) => e.id).sort()).toEqual(
      ["clue:q:sub->c:sub:c1", "front:f:f->q:main", "link:q:main->a:npc", "link:q:main->a:town", "place:c:sub:c1->a:npc", "sub:q:main->q:sub"].sort()
    );
    expect(edges.find((e) => e.target === "a:npc" && e.kind === "link")?.label).toBe("Giver");
    // Without clues, articles move up a column.
    const noClues = questMapGraph(quests, [], (r) => names[r.articleId] ?? null, { showClues: false });
    expect(noClues.nodes.some((n) => n.kind === "clue")).toBe(false);
    expect(noClues.nodes.find((n) => n.id === "a:npc")?.rank).toBe(3);
  });

  it("lays nodes out by column unless they were placed", () => {
    const nodes = questMapGraph([quest("a"), quest("b")], [], () => null).nodes;
    expect(layoutMap(nodes, { "q:b": { x: 5, y: 6 } })).toEqual({ "q:a": { x: MAP_COLUMN, y: 0 }, "q:b": { x: 5, y: 6 } });
    expect(layoutMap(nodes, {})["q:b"]).toEqual({ x: MAP_COLUMN, y: MAP_ROW });
  });
});
