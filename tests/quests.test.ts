import { describe, expect, it } from "vitest";
import { advanceFront, applyLogLine, frontAction, setFrontClock, boardColumns, changedLogLines, clueCoverage, descendantsOf, normalizeLogLine, questHistory, questProgress, questTree, rewardsToSessionLines, wouldCycle } from "../src/server/quests/logic";
import { parseClock, parseClues, parseObjectives, parsePortents, parseQuestLinks, parseQuestLog, parseQuestPriority, parseQuestStatus, parseQuestTitle, parseRewards } from "../src/server/quests/parse";
import type { Clue, Objective, QuestLogLine } from "../src/server/quests/types";

const ob = (id: string, state: Objective["state"] = "open", optional = false): Objective => ({ id, text: id, state, optional });
const q = (id: string, parentId: string | null = null, sortOrder = 0) => ({ id, parentId, sortOrder, title: id });
const line = (questId: string, action: QuestLogLine["action"], objectiveIds: string[] = [], more: Partial<QuestLogLine> = {}): QuestLogLine => ({ questId, action, note: "", objectiveIds, clueIds: [], clockTicks: 0, rewardsAdded: false, ...more });
const clue = (id: string, revealed = false, placed = 1): Clue => ({ id, text: id, placedIn: Array.from({ length: placed }, (_, i) => ({ template: "character", articleId: `${id}-p${i}` })), revealed, revealedSessionId: null });
const quest = (status: "hook" | "active" | "onHold" | "completed" = "hook") => ({ status, objectives: [ob("o1"), ob("o2")], clues: [clue("c1"), clue("c2")], clock: { segments: 6 as const, filled: 1, label: "" } });

describe("quest logic", () => {
  it("counts required objectives only", () => {
    expect(questProgress([ob("a", "done"), ob("b"), ob("c", "done", true), ob("d", "failed")])).toEqual({ done: 1, total: 3 });
    expect(questProgress([])).toEqual({ done: 0, total: 0 });
  });

  it("detects parent cycles", () => {
    const list = [q("a"), q("b", "a"), q("c", "b")];
    expect(wouldCycle(list, "a", "c")).toBe(true);
    expect(wouldCycle(list, "a", "a")).toBe(true);
    expect(wouldCycle(list, "c", "a")).toBe(false);
    expect(wouldCycle(list, "b", null)).toBe(false);
    expect([...descendantsOf(list, "a")].sort()).toEqual(["b", "c"]);
  });

  it("builds the sub-quest tree; orphans become roots", () => {
    const tree = questTree([q("b", "a", 1), q("a"), q("c", "a", 0), q("x", "gone")]);
    expect(tree.map((n) => n.quest.id)).toEqual(["a", "x"]);
    expect(tree[0].children.map((n) => n.quest.id)).toEqual(["c", "b"]);
  });

  it("sorts board columns by order, then title", () => {
    const cols = boardColumns([
      { status: "active" as const, sortOrder: 1, title: "B" },
      { status: "active" as const, sortOrder: 0, title: "Z" },
      { status: "hook" as const, sortOrder: 0, title: "A" },
    ]);
    expect(cols.active.map((c) => c.title)).toEqual(["Z", "B"]);
    expect(cols.hook).toHaveLength(1);
    expect(cols.completed).toEqual([]);
  });

  it("lists a quest's history oldest session first", () => {
    const s = (id: string, number: number, log: QuestLogLine[]) => ({ id, number, title: "", playedOn: null, startDay: null, questLog: log });
    const rows = questHistory([s("s2", 2, [line("q", "completed")]), s("s1", 1, [line("q", "started"), line("other", "advanced")])], "q");
    expect(rows.map((r) => [r.sessionNumber, r.action])).toEqual([
      [1, "started"],
      [2, "completed"],
    ]);
  });

  it("applies only changed log lines", () => {
    const before = [line("a", "advanced", ["o1"]), line("b", "started")];
    const after = [line("a", "advanced", ["o1"]), line("b", "completed"), line("c", "started")];
    const changed = changedLogLines(before, after);
    expect(changed.map((c) => c.line.questId)).toEqual(["b", "c"]);
    expect(changed[0].previous?.action).toBe("started");
    expect(changed[1].previous).toBeNull();
    expect(changedLogLines(after, after)).toEqual([]);
    expect(changedLogLines([line("a", "advanced")], [line("a", "advanced", [], { clockTicks: 2 })])).toHaveLength(1);
  });

  it("moves quests along from the log", () => {
    const fresh = (l: QuestLogLine) => ({ line: l, previous: null });
    const out = applyLogLine(quest(), fresh(line("q", "advanced", ["o1"], { clueIds: ["c2"], clockTicks: 2 })), "s1");
    expect(out.status).toBe("active");
    expect(out.objectives.map((o) => o.state)).toEqual(["done", "open"]);
    expect(out.clues.map((c) => [c.revealed, c.revealedSessionId])).toEqual([
      [false, null],
      [true, "s1"],
    ]);
    expect(out.clock?.filled).toBe(3);
    expect(applyLogLine(quest(), fresh(line("q", "completed")), "s1").status).toBe("completed");
    expect(applyLogLine(quest("completed"), fresh(line("q", "advanced")), "s1").status).toBe("completed");
    expect(applyLogLine(quest(), fresh(line("q", "failed")), "s1").status).toBe("failed");
  });

  it("applies only the change in clock ticks and keeps a manual status", () => {
    const previous = line("q", "advanced", [], { clockTicks: 2 });
    const out = applyLogLine(quest("onHold"), { line: line("q", "advanced", [], { clockTicks: 3 }), previous }, "s1");
    expect(out.clock?.filled).toBe(2);
    expect(out.status).toBe("onHold");
    expect(applyLogLine(quest(), { line: line("q", "advanced", [], { clockTicks: -12 }), previous: null }, "s1").clock?.filled).toBe(0);
  });

  it("fills in older log lines", () => {
    expect(normalizeLogLine({ questId: "q", action: "started" })).toEqual(line("q", "started"));
  });

  it("measures clue coverage (Three Clue Rule)", () => {
    expect(clueCoverage([clue("a"), clue("b", true), clue("c", false, 0)])).toEqual({ total: 3, revealed: 1, placed: 1, underThree: false });
    expect(clueCoverage([clue("a")]).underThree).toBe(true);
  });

  it("turns rewards into party-stash session lines", () => {
    let n = 0;
    const out = rewardsToSessionLines({ xp: 300, coins: [{ currencyId: "gp", amount: 50 }], items: [{ id: "i", name: "Sword", template: "item", articleId: "sw", quantity: 1 }] }, (p) => `${p}-${++n}`);
    expect(out.xp).toBe(300);
    expect(out.coins).toEqual([{ id: "cn-2", currencyId: "gp", amount: 50, recipient: "party" }]);
    expect(out.loot).toEqual([{ id: "lt-1", name: "Sword", template: "item", articleId: "sw", quantity: 1, value: null, recipient: "party" }]);
  });

  it("advances a front: one segment, the next portent", () => {
    const front = { clock: { segments: 4 as const, filled: 3, label: "" }, portents: [{ id: "a", text: "a", happened: true }, { id: "b", text: "b", happened: false }, { id: "c", text: "c", happened: false }] };
    const next = advanceFront(front);
    expect(next.clock?.filled).toBe(4);
    expect(next.portents.map((p) => p.happened)).toEqual([true, true, false]);
    expect(advanceFront(next).clock?.filled).toBe(4);
    expect(advanceFront({ clock: null, portents: [] })).toEqual({ clock: null, portents: [] });
  });

  it("with a clock per portent, a portent happens only when the clock fills, then it starts over", () => {
    let front = { clockPerPortent: true, clock: { segments: 4 as const, filled: 0, label: "" }, portents: ["a", "b", "c"].map((id) => ({ id, text: id, happened: false })) };
    const happened = () => front.portents.map((p) => p.happened);
    for (let i = 0; i < 3; i++) front = advanceFront(front);
    expect([front.clock.filled, happened()]).toEqual([3, [false, false, false]]);
    expect(frontAction(front)).toBe("advance");
    front = advanceFront(front);
    expect([front.clock.filled, happened()]).toEqual([4, [true, false, false]]);
    expect(frontAction(front)).toBe("nextPortent");
    front = advanceFront(front);
    expect([front.clock.filled, happened()]).toEqual([0, [true, false, false]]);
    // 4 ticks fill it (b), Next portent starts it over, 4 more fill it (c).
    for (let i = 0; i < 9; i++) front = advanceFront(front);
    expect([front.clock.filled, happened()]).toEqual([4, [true, true, true]]);
    expect(frontAction(front)).toBeNull();
    expect(advanceFront(front)).toBe(front);
  });

  it("with a clock per portent, filling the clock by hand marks the next portent", () => {
    const front = { clockPerPortent: true, clock: { segments: 6 as const, filled: 2, label: "" }, portents: [{ id: "a", text: "a", happened: false }] };
    expect(setFrontClock(front, 6).portents[0].happened).toBe(true);
    expect(setFrontClock(front, 5).portents[0].happened).toBe(false);
    expect(setFrontClock({ ...front, clockPerPortent: false }, 6).portents[0].happened).toBe(false);
  });
});

describe("quest parsers", () => {
  it("validates the basics", () => {
    expect(parseQuestTitle("  The Missing Caravan ")).toBe("The Missing Caravan");
    expect(() => parseQuestTitle("  ")).toThrow(/needs a title/);
    expect(parseQuestStatus("onHold")).toBe("onHold");
    expect(() => parseQuestStatus("done")).toThrow(/status/);
    expect(parseQuestPriority(2)).toBe(2);
    expect(() => parseQuestPriority(3)).toThrow(/priority/);
  });

  it("cleans objectives and links", () => {
    expect(parseObjectives([{ id: "a", text: " Find him " }, { id: "b", text: "" }])).toEqual([{ id: "a", text: "Find him", state: "open", optional: false }]);
    expect(() => parseObjectives([{ id: "a", text: "x" }, { id: "a", text: "y" }])).toThrow(/same id/);
    expect(() => parseObjectives(Array.from({ length: 51 }, (_, i) => ({ id: `o${i}`, text: "x" })))).toThrow(/at most 50/);
    expect(parseQuestLinks([{ template: "character", articleId: "p1" }, { template: "character", articleId: "p1", role: "antagonist" }])).toEqual([{ template: "character", articleId: "p1", role: "antagonist" }]);
    expect(() => parseQuestLinks([{ template: "character", articleId: "p1", role: "boss" }])).toThrow(/role/);
  });

  it("checks the session quest log", () => {
    const ids = new Set(["q1", "q2"]);
    expect(parseQuestLog([{ questId: "q1", action: "advanced", objectiveIds: ["o", "o"] }], ids)).toEqual([line("q1", "advanced", ["o"])]);
    expect(parseQuestLog([{ questId: "q1", action: "advanced", clueIds: ["c"], clockTicks: 2, rewardsAdded: true }], ids)).toEqual([line("q1", "advanced", [], { clueIds: ["c"], clockTicks: 2, rewardsAdded: true })]);
    expect(() => parseQuestLog([{ questId: "q1", action: "advanced", clockTicks: 13 }], ids)).toThrow(/Clock ticks/);
    expect(() => parseQuestLog([{ questId: "zz", action: "started" }], ids)).toThrow(/isn't in this campaign/);
    expect(() => parseQuestLog([{ questId: "q1", action: "started" }, { questId: "q1", action: "completed" }], ids)).toThrow(/only once/);
    expect(() => parseQuestLog([{ questId: "q1", action: "won" }], ids)).toThrow(/action/);
  });
});

describe("quest depth parsers", () => {
  it("parses clues, clocks and portents", () => {
    expect(parseClues([{ id: "c", text: " The seal is fake ", placedIn: [{ template: "character", articleId: "p" }, { template: "character", articleId: "p" }] }, { id: "d", text: "" }])).toEqual([
      { id: "c", text: "The seal is fake", placedIn: [{ template: "character", articleId: "p" }], revealed: false, revealedSessionId: null },
    ]);
    expect(parseClock({ segments: 6, filled: 2, label: " Ritual " })).toEqual({ segments: 6, filled: 2, label: "Ritual" });
    expect(parseClock(null)).toBeNull();
    expect(() => parseClock({ segments: 5 })).toThrow(/segments/);
    expect(() => parseClock({ segments: 4, filled: 5 })).toThrow(/filled/);
    expect(parsePortents([{ id: "a", text: "Villages burn" }, { id: "b", text: " " }])).toEqual([{ id: "a", text: "Villages burn", happened: false }]);
  });

  it("parses rewards in the campaign's coins", () => {
    const coins = new Set(["gp"]);
    expect(parseRewards({ xp: 100, coins: [{ currencyId: "gp", amount: 5 }], items: [{ id: "i", name: "Ring" }] }, coins)).toEqual({
      xp: 100,
      coins: [{ currencyId: "gp", amount: 5 }],
      items: [{ id: "i", name: "Ring", template: null, articleId: null, quantity: 1 }],
    });
    expect(parseRewards({ xp: null, coins: [], items: [] }, coins)).toBeNull();
    expect(() => parseRewards({ coins: [{ currencyId: "zz", amount: 5 }] }, coins)).toThrow(/coin this campaign/);
    expect(() => parseRewards({ xp: -1 }, coins)).toThrow(/XP/);
  });
});
