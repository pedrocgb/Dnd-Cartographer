/**
 * Quest tracker logic (pure; relative imports only): progress, the sub-quest
 * tree, board columns, a quest's history from session logs, and what a
 * session's quest log does to a quest.
 */
import { PARTY, type CoinLine, type LootLine } from "../sessions/types";
import { QUEST_DAY_KINDS, QUEST_STATUSES, type Clock, type Clue, type LogAction, type Objective, type Portent, type QuestDayKind, type QuestLogLine, type QuestStatus, type Rewards } from "./types";

/** Done / total of the required objectives (optional ones don't count). Failed objectives count as settled, not done. */
export function questProgress(objectives: readonly Objective[]): { done: number; total: number } {
  const required = objectives.filter((o) => !o.optional);
  return { done: required.filter((o) => o.state === "done").length, total: required.length };
}

type Node = { id: string; parentId: string | null; sortOrder: number; title: string };

/**
 * Whether making `parentId` the parent of `id` would loop (a quest can't sit
 * under itself or one of its own sub-quests).
 */
export function wouldCycle(quests: readonly Pick<Node, "id" | "parentId">[], id: string, parentId: string | null): boolean {
  const parentOf = new Map(quests.map((q) => [q.id, q.parentId]));
  const seen = new Set<string>();
  for (let at: string | null = parentId; at !== null; at = parentOf.get(at) ?? null) {
    if (at === id || seen.has(at)) return true;
    seen.add(at);
  }
  return false;
}

export interface TreeNode<T> {
  quest: T;
  children: TreeNode<T>[];
}

/** Roots (and quests whose parent is missing) with their sub-quests, by board order then title. */
export function questTree<T extends Node>(quests: readonly T[]): TreeNode<T>[] {
  const ids = new Set(quests.map((q) => q.id));
  const byParent = new Map<string | null, T[]>();
  for (const q of quests) {
    const key = q.parentId && ids.has(q.parentId) ? q.parentId : null;
    byParent.set(key, [...(byParent.get(key) ?? []), q]);
  }
  const order = (a: T, b: T) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title);
  const build = (parent: string | null, path: Set<string>): TreeNode<T>[] =>
    (byParent.get(parent) ?? [])
      .filter((q) => !path.has(q.id))
      .sort(order)
      .map((q) => ({ quest: q, children: build(q.id, new Set(path).add(q.id)) }));
  return build(null, new Set());
}

/** Every descendant id of a quest. */
export function descendantsOf(quests: readonly Pick<Node, "id" | "parentId">[], id: string): Set<string> {
  const out = new Set<string>();
  const walk = (parent: string) => {
    for (const q of quests) {
      if (q.parentId === parent && !out.has(q.id)) {
        out.add(q.id);
        walk(q.id);
      }
    }
  };
  walk(id);
  return out;
}

/** The board: one column per status, cards by sortOrder then title. */
export function boardColumns<T extends { status: QuestStatus; sortOrder: number; title: string }>(quests: readonly T[]): Record<QuestStatus, T[]> {
  const columns = Object.fromEntries(QUEST_STATUSES.map((s) => [s, [] as T[]])) as Record<QuestStatus, T[]>;
  for (const q of quests) columns[q.status].push(q);
  for (const s of QUEST_STATUSES) columns[s].sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
  return columns;
}

export interface HistoryRow {
  sessionId: string;
  sessionNumber: number;
  sessionTitle: string;
  playedOn: string | null;
  startDay: number | null;
  action: LogAction;
  note: string;
  objectiveIds: string[];
  clueIds: string[];
  clockTicks: number;
}

/** A quest's history: every session that logged it, oldest first. */
export function questHistory(
  sessions: readonly { id: string; number: number; title: string; playedOn: string | null; startDay: number | null; questLog: readonly QuestLogLine[] }[],
  questId: string
): HistoryRow[] {
  return [...sessions]
    .sort((a, b) => a.number - b.number)
    .flatMap((s) =>
      s.questLog
        .filter((l) => l.questId === questId)
        .map((l) => ({ sessionId: s.id, sessionNumber: s.number, sessionTitle: s.title, playedOn: s.playedOn, startDay: s.startDay, action: l.action, note: l.note, objectiveIds: l.objectiveIds, clueIds: l.clueIds, clockTicks: l.clockTicks }))
    );
}

/** A stored log line with the fields older lines lack filled in. */
export function normalizeLogLine(raw: Partial<QuestLogLine> & Pick<QuestLogLine, "questId" | "action">): QuestLogLine {
  return {
    questId: raw.questId,
    action: raw.action,
    note: raw.note ?? "",
    objectiveIds: raw.objectiveIds ?? [],
    clueIds: raw.clueIds ?? [],
    clockTicks: raw.clockTicks ?? 0,
    rewardsAdded: raw.rewardsAdded === true,
  };
}

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((id) => b.includes(id));

const sameLine = (a: QuestLogLine, b: QuestLogLine) => a.action === b.action && a.clockTicks === b.clockTicks && sameSet(a.objectiveIds, b.objectiveIds) && sameSet(a.clueIds, b.clueIds);

export interface LogChange {
  line: QuestLogLine;
  /** The same quest's line as saved before, or null for a new one. */
  previous: QuestLogLine | null;
}

/**
 * The lines of a session's new quest log that change something compared with
 * its saved one (new quests, another action, more objectives or clues, other
 * clock ticks). Only these are applied to the quests, so re-saving a session
 * never re-does old changes; removing a line doesn't undo it either (the
 * quest keeps its state).
 */
export function changedLogLines(before: readonly QuestLogLine[], after: readonly QuestLogLine[]): LogChange[] {
  return after.flatMap((line) => {
    const previous = before.find((b) => b.questId === line.questId) ?? null;
    return previous && sameLine(previous, line) ? [] : [{ line, previous }];
  });
}

type Applied = { status: QuestStatus; objectives: Objective[]; clues: Clue[]; clock: Clock | null };

/**
 * What a logged line does to its quest: objectives done, clues revealed (in
 * `sessionId`), the clock moved by the change in ticks, and a status change
 * when the action is new (started/advanced make a hook or paused quest
 * active; completed/failed close it).
 */
export function applyLogLine(quest: Applied, { line, previous }: LogChange, sessionId: string): Applied {
  const done = new Set(line.objectiveIds);
  const learned = new Set(line.clueIds);
  const objectives = quest.objectives.map((o) => (done.has(o.id) && o.state !== "done" ? { ...o, state: "done" as const } : o));
  const clues = quest.clues.map((c) => (learned.has(c.id) && !c.revealed ? { ...c, revealed: true, revealedSessionId: sessionId } : c));
  const ticks = line.clockTicks - (previous?.clockTicks ?? 0);
  const clock = quest.clock && ticks ? { ...quest.clock, filled: Math.min(quest.clock.segments, Math.max(0, quest.clock.filled + ticks)) } : quest.clock;
  let status = quest.status;
  if (!previous || previous.action !== line.action) {
    if (line.action === "completed") status = "completed";
    else if (line.action === "failed") status = "failed";
    else if (quest.status === "hook" || quest.status === "onHold") status = "active"; // the party is on it
  }
  return { status, objectives, clues, clock };
}

/** How many clues point the party at this quest, and whether that's under the Three Clue Rule. */
export function clueCoverage(clues: readonly Clue[]): { total: number; revealed: number; placed: number; underThree: boolean } {
  const hidden = clues.filter((c) => !c.revealed);
  return { total: clues.length, revealed: clues.length - hidden.length, placed: hidden.filter((c) => c.placedIn.length > 0).length, underThree: clues.length < 3 };
}

/** A quest's rewards as session lines, all to the party stash (the DM can hand them out after). */
export function rewardsToSessionLines(rewards: Rewards, newId: (prefix: string) => string): { xp: number | null; loot: LootLine[]; coins: CoinLine[] } {
  return {
    xp: rewards.xp,
    loot: rewards.items.map((it) => ({ id: newId("lt"), name: it.name, template: it.template, articleId: it.articleId, quantity: it.quantity, value: null, recipient: PARTY })),
    coins: rewards.coins.map((c) => ({ id: newId("cn"), currencyId: c.currencyId, amount: c.amount, recipient: PARTY })),
  };
}

type FrontSteps = { clock: Clock | null; portents: readonly Portent[]; clockPerPortent?: boolean };

const markNext = (portents: readonly Portent[]) => {
  const next = portents.findIndex((p) => !p.happened);
  return portents.map((p, i) => (i === next ? { ...p, happened: true } : p));
};

/** What Advance does next: tick ("advance"), start the clock over for the next portent ("nextPortent"), or nothing left (null). */
export function frontAction(front: FrontSteps): "advance" | "nextPortent" | null {
  const left = front.portents.some((p) => !p.happened);
  if (!front.clock) return left ? "advance" : null;
  const full = front.clock.filled >= front.clock.segments;
  if (front.clockPerPortent) return full ? (left ? "nextPortent" : null) : "advance";
  return full && !left ? null : "advance";
}

/**
 * Sets a front's clock. With a clock per portent, filling it up marks the
 * next grim portent as happened.
 */
export function setFrontClock<T extends FrontSteps>(front: T, filled: number): T {
  if (!front.clock) return front;
  const clock = { ...front.clock, filled: Math.max(0, Math.min(front.clock.segments, filled)) };
  const fills = front.clockPerPortent && front.clock.filled < front.clock.segments && clock.filled >= clock.segments;
  return { ...front, clock, portents: fills ? markNext(front.portents) : front.portents };
}

/**
 * The front's next step. Normally: one more clock segment (when it has a
 * clock) and the next grim portent comes to pass. With a clock per portent:
 * one more segment, the next portent only when that fills the clock; once
 * full, the clock starts over for the next portent.
 */
export function advanceFront<T extends FrontSteps>(front: T): T {
  const action = frontAction(front);
  if (!action) return front;
  if (front.clockPerPortent && front.clock) return action === "nextPortent" ? { ...front, clock: { ...front.clock, filled: 0 } } : setFrontClock(front, front.clock.filled + 1);
  return {
    ...front,
    clock: front.clock ? { ...front.clock, filled: Math.min(front.clock.segments, front.clock.filled + 1) } : null,
    portents: markNext(front.portents),
  };
}

/** The quests with an in-world date on this day, and which date it is (a quest can start and be due the same day). */
export function questsOnDay<T extends { startDay: number | null; deadlineDay: number | null; endDay: number | null }>(list: readonly T[], day: number): { quest: T; kind: QuestDayKind }[] {
  return list.flatMap((quest) => QUEST_DAY_KINDS.filter((k) => quest[`${k}Day`] === day).map((kind) => ({ quest, kind })));
}

/** Days left until a quest's deadline from `today` (negative once past), or null without one. */
export const daysToDeadline = (quest: { deadlineDay: number | null }, today: number) => (quest.deadlineDay === null ? null : quest.deadlineDay - today);
