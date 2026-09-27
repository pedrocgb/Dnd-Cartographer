/**
 * Strict parsers for quest JSON coming from clients (pure; relative imports
 * only). Each returns the cleaned value or throws ParseError (a 400) with a
 * plain-language message.
 */
import { ParseError } from "../calendars/parse";
import {
  CLOCK_SIZES,
  FRONT_KINDS,
  FRONT_STATUSES,
  LINK_ROLES,
  LOG_ACTIONS,
  OBJECTIVE_STATES,
  QUEST_KINDS,
  QUEST_PRIORITIES,
  QUEST_STATUSES,
  type ArticleRef,
  type Clock,
  type ClockSize,
  type Clue,
  type MapPoint,
  type FrontKind,
  type FrontStatus,
  type LinkRole,
  type Portent,
  type Rewards,
  type Objective,
  type QuestKind,
  type QuestLink,
  type QuestLogLine,
  type QuestPriority,
  type QuestStatus,
} from "./types";

export const MAX_OBJECTIVES = 50;
export const MAX_LINKS = 100;
export const MAX_LOG = 100;
export const MAX_CLUES = 50;
export const MAX_PLACES = 10;
export const MAX_PORTENTS = 12;
export const MAX_REWARD_ROWS = 20;
const MAX_XP = 10_000_000;
const MAX_AMOUNT = 1_000_000_000;
const MAX_TITLE = 160;
const MAX_LINE = 500;
const MAX_SUMMARY = 2000;

const fail = (message: string): never => {
  throw new ParseError(message);
};

const obj = (v: unknown, what: string): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : fail(`${what} is missing or malformed.`);

const list = (v: unknown, what: string, max: number): unknown[] => {
  if (!Array.isArray(v)) return fail(`${what} must be a list.`);
  if (v.length > max) fail(`${what} can have at most ${max} items.`);
  return v;
};

const ident = (v: unknown, what: string): string => (typeof v === "string" && v.length > 0 && v.length <= 64 ? v : fail(`${what} needs a valid id.`));

const text = (v: unknown, what: string, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : v == null ? "" : fail(`${what} must be text.`));

const oneOf = <T extends string>(values: readonly T[], v: unknown, what: string): T => ((values as readonly unknown[]).includes(v) ? (v as T) : fail(`${what} isn't valid.`));

export function parseQuestTitle(v: unknown): string {
  const title = text(v, "The quest's title", MAX_TITLE);
  return title || fail("A quest needs a title.");
}

export const parseQuestSummary = (v: unknown) => text(v, "The summary", MAX_SUMMARY);
export const parseQuestStatus = (v: unknown): QuestStatus => oneOf(QUEST_STATUSES, v, "The quest's status");
export const parseQuestKind = (v: unknown): QuestKind => oneOf(QUEST_KINDS, v, "The quest's type");

export function parseQuestPriority(v: unknown): QuestPriority {
  return (QUEST_PRIORITIES as readonly unknown[]).includes(v) ? (v as QuestPriority) : fail("The priority must be low, normal or high.");
}

export function parseSortOrder(v: unknown): number {
  return Number.isSafeInteger(v) && (v as number) >= 0 && (v as number) <= 1_000_000 ? (v as number) : fail("The board position isn't valid.");
}

const ref = (v: unknown, what: string): ArticleRef => {
  const x = obj(v, what);
  return { template: ident(x.template, what), articleId: ident(x.articleId, what) };
};

/** Who gave the quest: one article, or null. */
export const parseGiver = (v: unknown): ArticleRef | null => (v === null || v === undefined ? null : ref(v, "The quest giver"));

/** Involved articles with their role; one row per article (the last role wins). */
export function parseQuestLinks(v: unknown): QuestLink[] {
  const byId = new Map<string, QuestLink>();
  list(v ?? [], "Linked articles", MAX_LINKS).forEach((l, i) => {
    const x = obj(l, `Linked article ${i + 1}`);
    const r = ref(x, `Linked article ${i + 1}`);
    const role: LinkRole = x.role === undefined ? "other" : oneOf(LINK_ROLES, x.role, `Linked article ${i + 1}'s role`);
    byId.set(r.articleId, { ...r, role });
  });
  return [...byId.values()];
}

export function parseObjectives(v: unknown): Objective[] {
  const out = list(v ?? [], "Objectives", MAX_OBJECTIVES)
    .map((o, i): Objective => {
      const x = obj(o, `Objective ${i + 1}`);
      return {
        id: ident(x.id, `Objective ${i + 1}`),
        text: text(x.text, "An objective", MAX_LINE),
        state: x.state === undefined ? "open" : oneOf(OBJECTIVE_STATES, x.state, `Objective ${i + 1}'s state`),
        optional: x.optional === true,
      };
    })
    .filter((o) => o.text);
  if (new Set(out.map((o) => o.id)).size !== out.length) fail("Two objectives share the same id.");
  return out;
}

/**
 * A session's quest log: quests of this campaign only (`questIds`), one line
 * per quest, objectives deduped.
 */
export function parseQuestLog(v: unknown, questIds: ReadonlySet<string>): QuestLogLine[] {
  const seen = new Set<string>();
  return list(v ?? [], "The quest log", MAX_LOG).map((l, i): QuestLogLine => {
    const x = obj(l, `Quest log line ${i + 1}`);
    const questId = ident(x.questId, `Quest log line ${i + 1}`);
    if (!questIds.has(questId)) fail("The quest log names a quest that isn't in this campaign.");
    if (seen.has(questId)) fail("A quest can appear only once in a session's quest log.");
    seen.add(questId);
    const objectiveIds = [...new Set(list(x.objectiveIds ?? [], "Objectives done", MAX_OBJECTIVES).map((o) => ident(o, "An objective")))];
    const clueIds = [...new Set(list(x.clueIds ?? [], "Clues learned", MAX_CLUES).map((o) => ident(o, "A clue")))];
    const clockTicks = x.clockTicks === undefined ? 0 : int(x.clockTicks, "Clock ticks", -12, 12);
    return {
      questId,
      action: oneOf(LOG_ACTIONS, x.action, `Quest log line ${i + 1}'s action`),
      note: text(x.note, "A quest log note", MAX_LINE),
      objectiveIds,
      clueIds,
      clockTicks,
      rewardsAdded: x.rewardsAdded === true,
    };
  });
}

const int = (v: unknown, what: string, min: number, max: number): number =>
  Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max ? (v as number) : fail(`${what} must be a whole number from ${min.toLocaleString("en-US")} to ${max.toLocaleString("en-US")}.`);

const refs = (v: unknown, what: string, max: number): ArticleRef[] => {
  const byId = new Map<string, ArticleRef>();
  list(v ?? [], what, max).forEach((r, i) => {
    const x = ref(r, `${what} ${i + 1}`);
    byId.set(x.articleId, x);
  });
  return [...byId.values()];
};

/** Secrets & clues: text, where each can be found, whether the party knows it. */
export function parseClues(v: unknown): Clue[] {
  const out = list(v ?? [], "Clues", MAX_CLUES)
    .map((c, i): Clue => {
      const x = obj(c, `Clue ${i + 1}`);
      return {
        id: ident(x.id, `Clue ${i + 1}`),
        text: text(x.text, "A clue", MAX_LINE),
        placedIn: refs(x.placedIn, "A clue's place", MAX_PLACES),
        revealed: x.revealed === true,
        revealedSessionId: x.revealedSessionId == null ? null : ident(x.revealedSessionId, "The session a clue came out in"),
      };
    })
    .filter((c) => c.text);
  if (new Set(out.map((c) => c.id)).size !== out.length) fail("Two clues share the same id.");
  return out;
}

/** A progress clock (4–12 segments), or null for none. */
export function parseClock(v: unknown): Clock | null {
  if (v === null || v === undefined) return null;
  const x = obj(v, "The clock");
  const segments = (CLOCK_SIZES as readonly unknown[]).includes(x.segments) ? (x.segments as ClockSize) : fail(`A clock has ${CLOCK_SIZES.join(", ")} segments.`);
  return { segments, filled: int(x.filled ?? 0, "The clock's filled segments", 0, segments), label: text(x.label, "The clock's label", 80) };
}

/** Rewards: XP, the campaign's coins (`currencyIds`), items (names or linked articles). Null when there are none. */
export function parseRewards(v: unknown, currencyIds: ReadonlySet<string>): Rewards | null {
  if (v === null || v === undefined) return null;
  const x = obj(v, "The rewards");
  const xp = x.xp === null || x.xp === undefined || x.xp === "" ? null : int(x.xp, "Reward XP", 0, MAX_XP);
  const coins = list(x.coins ?? [], "Reward coins", MAX_REWARD_ROWS).map((c, i) => {
    const y = obj(c, `Reward coin ${i + 1}`);
    const currencyId = ident(y.currencyId, `Reward coin ${i + 1}`);
    if (!currencyIds.has(currencyId)) fail("A reward is in a coin this campaign doesn't use.");
    return { currencyId, amount: int(y.amount, "A reward amount", 1, MAX_AMOUNT) };
  });
  const items = list(x.items ?? [], "Reward items", MAX_REWARD_ROWS)
    .map((it, i) => {
      const y = obj(it, `Reward item ${i + 1}`);
      const linked = y.articleId ? ref(y, `Reward item ${i + 1}`) : null;
      return { id: ident(y.id, `Reward item ${i + 1}`), name: text(y.name, "A reward item", 120), template: linked?.template ?? null, articleId: linked?.articleId ?? null, quantity: int(y.quantity ?? 1, "A reward quantity", 1, 100_000) };
    })
    .filter((it) => it.name || it.articleId);
  return xp === null && coins.length === 0 && items.length === 0 ? null : { xp, coins, items };
}

const DAY_LIMIT = 100_000_000;

/**
 * A quest's in-world days (each null or a world day): the end can't be
 * before the start, nor the deadline. Only the keys present are returned.
 */
export function parseQuestDays(body: Record<string, unknown>): { startDay?: number | null; deadlineDay?: number | null; endDay?: number | null } {
  const out: { startDay?: number | null; deadlineDay?: number | null; endDay?: number | null } = {};
  const day = (v: unknown, what: string) => (v === null || v === undefined || v === "" ? null : int(v, what, -DAY_LIMIT, DAY_LIMIT));
  if ("startDay" in body) out.startDay = day(body.startDay, "The quest's start");
  if ("deadlineDay" in body) out.deadlineDay = day(body.deadlineDay, "The quest's deadline");
  if ("endDay" in body) out.endDay = day(body.endDay, "The quest's end");
  const start = out.startDay ?? null;
  if (start !== null && out.endDay != null && out.endDay < start) fail("A quest can't end before it starts.");
  if (start !== null && out.deadlineDay != null && out.deadlineDay < start) fail("A quest's deadline can't be before it starts.");
  return out;
}

export const MAX_MAP_NODES = 2000;
const MAP_LIMIT = 1_000_000;

/** Quest map positions to save: `{ nodeId: {x, y} }`, or null to forget one (back to the automatic layout). */
export function parseMapPositions(v: unknown): Record<string, MapPoint | null> {
  const x = obj(v, "The map positions");
  const entries = Object.entries(x);
  if (entries.length > MAX_MAP_NODES) fail(`The map can hold at most ${MAX_MAP_NODES} nodes.`);
  const coord = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= MAP_LIMIT ? Math.round(n) : fail("A map position is out of range."));
  return Object.fromEntries(
    entries.map(([key, p]) => {
      if (key.length === 0 || key.length > 100) fail("A map node needs a valid id.");
      if (p === null) return [key, null];
      const point = obj(p, "A map position");
      return [key, { x: coord(point.x), y: coord(point.y) }];
    })
  );
}

export function parseFrontName(v: unknown): string {
  const name = text(v, "The front's name", 120);
  return name || fail("A front needs a name.");
}

export const parseFrontKind = (v: unknown): FrontKind => oneOf(FRONT_KINDS, v, "The front's type");
export const parseFrontStatus = (v: unknown): FrontStatus => oneOf(FRONT_STATUSES, v, "The front's status");
export const parseFrontText = (v: unknown, what: string) => text(v, what, MAX_SUMMARY);

/** Grim portents, in order. */
export function parsePortents(v: unknown): Portent[] {
  const out = list(v ?? [], "Grim portents", MAX_PORTENTS)
    .map((p, i): Portent => {
      const x = obj(p, `Portent ${i + 1}`);
      return { id: ident(x.id, `Portent ${i + 1}`), text: text(x.text, "A portent", MAX_LINE), happened: x.happened === true };
    })
    .filter((p) => p.text);
  if (new Set(out.map((p) => p.id)).size !== out.length) fail("Two portents share the same id.");
  return out;
}
