import { describe, expect, it } from "vitest";
import { applyMoves, canNest, carrySecrets, checkMoves, descendantIds, healthWarnings, moveNode, readingOrder, reviewScene, templateChildren } from "../src/server/writer/logic";
import { parseMoves, parsePrep, parseReview, parseSetup, readPrep, readSetup } from "../src/server/writer/parse";
import { STORY_TEMPLATES } from "../src/server/writer/templates";
import { EMPTY_PREP, EMPTY_SETUP, type NodeKind } from "../src/server/writer/types";
import { extractMentions, mentionHref } from "../src/server/mentions/kinds";
import { deriveText, validateDocument } from "../src/server/documents/schema";
import type { Clue } from "../src/server/quests/types";

const n = (id: string, kind: NodeKind, parentId: string | null, sortOrder = 0) => ({ id, kind, parentId, sortOrder, title: id });

// arc A (chapters c1, c2); c1 has scenes s1, s2; c2 has s3.
const outline = [n("A", "arc", null), n("c1", "chapter", "A", 0), n("c2", "chapter", "A", 1), n("s1", "scene", "c1", 0), n("s2", "scene", "c1", 1), n("s3", "scene", "c2", 0)];

describe("outline nesting", () => {
  it("allows arcs at the root, chapters in arcs, scenes in chapters only", () => {
    expect(canNest(null, "arc")).toBe(true);
    expect(canNest("arc", "chapter")).toBe(true);
    expect(canNest("chapter", "scene")).toBe(true);
    expect(canNest(null, "scene")).toBe(false);
    expect(canNest("arc", "scene")).toBe(false);
    expect(canNest("scene", "scene")).toBe(false);
  });

  it("rejects moves that break nesting or point outside the outline", () => {
    expect(checkMoves(outline, [{ id: "s1", parentId: "c2", sortOrder: 0 }])).toBeNull();
    expect(checkMoves(outline, [{ id: "s1", parentId: "A", sortOrder: 0 }])).toMatch(/inside a chapter/);
    expect(checkMoves(outline, [{ id: "s1", parentId: "nope", sortOrder: 0 }])).toMatch(/isn't in/);
    expect(checkMoves(outline, [{ id: "ghost", parentId: null, sortOrder: 0 }])).toMatch(/isn't in/);
  });

  it("reads in story order and finds descendants", () => {
    expect(readingOrder(outline).map((x) => x.id)).toEqual(["A", "c1", "s1", "s2", "c2", "s3"]);
    expect([...descendantIds(outline, "A")].sort()).toEqual(["c1", "c2", "s1", "s2", "s3"]);
  });
});

describe("moveNode", () => {
  it("reorders among siblings", () => {
    const moves = moveNode(outline, "s2", "c1", 0)!;
    const after = readingOrder(applyMoves(outline, moves)).map((x) => x.id);
    expect(after).toEqual(["A", "c1", "s2", "s1", "c2", "s3"]);
  });

  it("moves into another chapter and renumbers both lists", () => {
    const moves = moveNode(outline, "s1", "c2", 99)!;
    const next = applyMoves(outline, moves);
    expect(readingOrder(next).map((x) => x.id)).toEqual(["A", "c1", "s2", "c2", "s3", "s1"]);
    expect(next.find((x) => x.id === "s2")!.sortOrder).toBe(0);
  });

  it("refuses a place the kind can't go", () => {
    expect(moveNode(outline, "s1", "A", 0)).toBeNull();
    expect(moveNode(outline, "c1", null, 0)).toBeNull();
  });
});

describe("story templates", () => {
  const counts: Record<string, number> = { "three-act": 3, "save-the-cat": 15, "heros-journey": 12, "story-circle": 8, kishotenketsu: 4, "five-room": 5 };
  it.each(Object.entries(counts))("%s has %i beats with unique keys and rising positions", (key, count) => {
    const t = STORY_TEMPLATES.find((x) => x.key === key)!;
    expect(t.beats).toHaveLength(count);
    expect(new Set(t.beats.map((b) => b.key)).size).toBe(count);
    t.beats.slice(1).forEach((b, i) => expect(b.pct).toBeGreaterThanOrEqual(t.beats[i].pct));
  });

  it("creates the level below the parent, never under a scene", () => {
    expect(templateChildren("five-room", "chapter")!.every((d) => d.kind === "scene")).toBe(true);
    expect(templateChildren("three-act", null)!.map((d) => d.kind)).toEqual(["arc", "arc", "arc"]);
    expect(templateChildren("three-act", "scene")).toBeNull();
    expect(templateChildren("nope", "arc")).toBeNull();
  });
});

const clue = (id: string, placed = 0): Clue => ({ id, text: id, placedIn: Array.from({ length: placed }, (_, i) => ({ template: "settlement", articleId: `${id}-${i}` })), revealed: false, revealedSessionId: null });
const thread = (id: string, kind: "promise" | "chekhov" | "mice" = "promise", status: "open" | "paid" | "dropped" = "open") => ({ id, name: id, kind, status });
const order = ["s1", "s2", "s3", "s4"];

describe("health warnings", () => {
  it("flags unplaced threads, missing payoffs and payoffs before setups", () => {
    const w = healthWarnings([thread("t1"), thread("t2"), thread("t3")], [
      { threadId: "t2", nodeId: "s1", role: "setup" },
      { threadId: "t3", nodeId: "s1", role: "payoff" },
      { threadId: "t3", nodeId: "s3", role: "setup" },
    ], order, []);
    expect(w.map((x) => x.key)).toEqual(["t1:unplaced", "t2:nopayoff", "t3:order"]);
  });

  it("says nothing about paid or dropped threads' payoffs", () => {
    const w = healthWarnings([thread("t1", "promise", "paid"), thread("t2", "chekhov", "dropped")], [{ threadId: "t1", nodeId: "s1", role: "setup" }], order, []);
    expect(w).toEqual([]);
  });

  it("flags MICE threads closing out of order (first opened, last closed)", () => {
    const w = healthWarnings([thread("outer", "mice"), thread("inner", "mice")], [
      { threadId: "outer", nodeId: "s1", role: "setup" },
      { threadId: "inner", nodeId: "s2", role: "setup" },
      { threadId: "outer", nodeId: "s3", role: "payoff" },
      { threadId: "inner", nodeId: "s4", role: "payoff" },
    ], order, []);
    expect(w.map((x) => x.key)).toEqual(["outer:inner:nest"]);
  });

  it("applies the Three Clue Rule to open quests only", () => {
    const w = healthWarnings([], [], order, [
      { id: "q1", title: "Few", status: "active", clues: [clue("a", 1)] },
      { id: "q2", title: "Unplaced", status: "hook", clues: [clue("a"), clue("b"), clue("c")] },
      { id: "q3", title: "Done", status: "completed", clues: [] },
      { id: "q4", title: "Fine", status: "active", clues: [clue("a", 1), clue("b", 1), clue("c", 1)] },
    ]);
    expect(w.map((x) => x.key)).toEqual(["q1:clues", "q2:placed"]);
  });
});

describe("session review", () => {
  it("records played and changed scenes on the session", () => {
    expect(reviewScene({ status: "ready", plannedSessionId: "S1" }, "played", "", "S1", "S2")).toEqual({ status: "played", playedSessionId: "S1", plannedSessionId: "S1" });
    expect(reviewScene({ status: "ready", plannedSessionId: "S1" }, "changed", "They fled", "S1", "S2")).toMatchObject({ status: "changed", changeNote: "They fled" });
  });

  it("moves scenes not reached to the next session, and cuts cut ones", () => {
    expect(reviewScene({ status: "ready", plannedSessionId: "S1" }, "later", "", "S1", "S2")).toEqual({ status: "ready", playedSessionId: null, plannedSessionId: "S2" });
    expect(reviewScene({ status: "played", plannedSessionId: "S1" }, "later", "", "S1", null)).toEqual({ status: "ready", playedSessionId: null, plannedSessionId: null });
    expect(reviewScene({ status: "ready", plannedSessionId: "S1" }, "skipped", "", "S1", "S2").status).toBe("skipped");
  });

  it("carries unrevealed secrets to the next session once", () => {
    const secrets = [
      { id: "a", text: "A", state: "unused" as const },
      { id: "b", text: "B", state: "unused" as const },
      { id: "c", text: "C", state: "unused" as const },
    ];
    const { reviewed, carried } = carrySecrets(secrets, { a: true }, [{ id: "c", text: "C", state: "unused" }]);
    expect(reviewed.map((s) => s.state)).toEqual(["revealed", "carried", "carried"]);
    expect(carried).toEqual([{ id: "b", text: "B", state: "unused" }]);
  });
});

describe("writer parsers", () => {
  it("rejects duplicate moves and keeps the rest", () => {
    expect(parseMoves([{ id: "a", parentId: null, sortOrder: 0 }])).toEqual([{ id: "a", parentId: null, sortOrder: 0 }]);
    expect(() => parseMoves([{ id: "a", sortOrder: 0 }, { id: "a", sortOrder: 1 }])).toThrow(/only once/);
    expect(() => parseMoves([{ id: "a", sortOrder: -1 }])).toThrow();
  });

  it("merges setup and prep patches and drops blank lines", () => {
    const setup = parseSetup({ truths: ["The gods are silent", "  "], guidesHidden: true }, { ...EMPTY_SETUP, pitch: "Keep me" });
    expect(setup).toMatchObject({ pitch: "Keep me", truths: ["The gods are silent"], guidesHidden: true });
    const prep = parsePrep({ strongStart: "Boom", secrets: [{ id: "s1", text: "x" }, { id: "s2", text: "" }] }, EMPTY_PREP);
    expect(prep.secrets).toEqual([{ id: "s1", text: "x", state: "unused" }]);
    expect(() => parsePrep({ secrets: [{ id: "s", text: "a" }, { id: "s", text: "b" }] }, EMPTY_PREP)).toThrow(/same id/);
  });

  it("reads stored JSON leniently", () => {
    expect(readSetup(null)).toEqual(EMPTY_SETUP);
    expect(readPrep({ secrets: [{ id: "a", text: "t", state: "weird" }, { bad: 1 }] }).secrets).toEqual([{ id: "a", text: "t", state: "unused" }]);
  });

  it("parses a review", () => {
    const r = parseReview({ scenes: [{ id: "s1", outcome: "later" }], secrets: { a: true }, entries: [{ text: "The baron is angry", kind: "npc" }, { text: "" }] });
    expect(r).toEqual({ scenes: [{ id: "s1", outcome: "later", changeNote: "" }], secrets: { a: true }, entries: [{ kind: "npc", subject: null, text: "The baron is angry" }] });
    expect(() => parseReview({ scenes: [{ id: "s1", outcome: "maybe" }] })).toThrow();
  });
});

const mention = (attrs: Record<string, unknown>) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Meet " }, { type: "mention", attrs }] }] });

describe("mentions", () => {
  it("extracts distinct valid targets from nested content", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "mention", attrs: { kind: "character", id: "p1", label: "Old", campaign: null } }] },
        { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "mention", attrs: { kind: "character", id: "p1", label: "Varek" } }, { type: "mention", attrs: { kind: "bogus", id: "x", label: "x" } }] }] }] },
      ],
    };
    expect(extractMentions(doc)).toEqual([{ kind: "character", id: "p1", label: "Varek", campaign: null }]);
  });

  it("links articles, quests and outline items", () => {
    expect(mentionHref({ kind: "character", id: "p1", campaign: null })).toBe("/articles?type=character&id=p1");
    expect(mentionHref({ kind: "quest", id: "q1", campaign: "c1" })).toBe("/sessions?campaign=c1&view=quests&quest=q1");
    expect(mentionHref({ kind: "node", id: "n1", campaign: "c1" })).toBe("/writer?campaign=c1&node=n1");
  });

  it("validates mention attributes and puts @label in the plain text", () => {
    expect(() => validateDocument(mention({ kind: "character", id: "p1", label: "Varek" }))).not.toThrow();
    expect(() => validateDocument(mention({ kind: "script", id: "p1", label: "x" }))).toThrow(/Unsupported mention/);
    expect(() => validateDocument(mention({ kind: "character", id: "<script>", label: "x" }))).toThrow(/target/);
    expect(() => validateDocument(mention({ kind: "character", id: "p1", label: "x".repeat(201) }))).toThrow(/label/);
    expect(deriveText(mention({ kind: "character", id: "p1", label: "Varek" }))).toBe("Meet @Varek");
  });
});
