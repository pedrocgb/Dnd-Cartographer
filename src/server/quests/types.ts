/**
 * Quest tracker shapes (pure data; relative imports only). A quest belongs
 * to a campaign; sub-quests point at a parent. Sessions log what happened to
 * quests (`QuestLogLine`), which is also each quest's history.
 */
import { wordedLabels as worded } from "../../i18n/worded";

const wordedLabels = <V extends string | number>(values: readonly V[], prefix: string) => worded("campaign", values, prefix);

export const QUEST_STATUSES = ["hook", "active", "onHold", "completed", "failed", "abandoned"] as const;
export type QuestStatus = (typeof QUEST_STATUSES)[number];

export const QUEST_STATUS_LABELS = wordedLabels(QUEST_STATUSES, "questStatus");

/** A quest that's over (no longer on the party's plate). */
export const isClosed = (status: QuestStatus) => status === "completed" || status === "failed" || status === "abandoned";

export const QUEST_KINDS = ["main", "side", "personal", "faction", "rumor"] as const;
export type QuestKind = (typeof QUEST_KINDS)[number];

export const QUEST_KIND_LABELS = wordedLabels(QUEST_KINDS, "questKind");

/** 0 low, 1 normal, 2 high. */
export const QUEST_PRIORITIES = [0, 1, 2] as const;
export type QuestPriority = (typeof QUEST_PRIORITIES)[number];
export const PRIORITY_LABELS = wordedLabels(QUEST_PRIORITIES, "priority");

/** What a linked article is to the quest (Kanka-style element roles). */
export const LINK_ROLES = ["ally", "antagonist", "location", "item", "faction", "other"] as const;
export type LinkRole = (typeof LINK_ROLES)[number];
export const LINK_ROLE_LABELS = wordedLabels(LINK_ROLES, "linkRole");

export interface ArticleRef {
  template: string;
  articleId: string;
}

export interface QuestLink extends ArticleRef {
  role: LinkRole;
}

export const OBJECTIVE_STATES = ["open", "done", "failed"] as const;
export type ObjectiveState = (typeof OBJECTIVE_STATES)[number];
export const OBJECTIVE_STATE_LABELS = wordedLabels(OBJECTIVE_STATES, "objectiveState");

export interface Objective {
  id: string;
  text: string;
  state: ObjectiveState;
  /** Doesn't count towards the quest's progress. */
  optional: boolean;
}

export const LOG_ACTIONS = ["started", "advanced", "completed", "failed"] as const;
export type LogAction = (typeof LOG_ACTIONS)[number];
export const LOG_ACTION_LABELS = wordedLabels(LOG_ACTIONS, "logAction");

/** One quest's line in a session's quest log. */
export interface QuestLogLine {
  questId: string;
  action: LogAction;
  note: string;
  /** Objectives done this session. */
  objectiveIds: string[];
  /** Clues the party learned this session. */
  clueIds: string[];
  /** Segments the quest's clock moved this session (negative winds it back). */
  clockTicks: number;
  /** The quest's rewards were added to this session's loot, coins and XP (never offered twice). */
  rewardsAdded: boolean;
}

/**
 * A secret or clue (Lazy DM "secrets & clues", the Three Clue Rule): one
 * revealable fact, placed where the party could find it.
 */
export interface Clue {
  id: string;
  text: string;
  /** Where it can be found: NPCs, places, items… */
  placedIn: ArticleRef[];
  revealed: boolean;
  /** The session it came out in, when logged there. */
  revealedSessionId: string | null;
}

/** Progress clock segment counts (Blades in the Dark style). */
export const CLOCK_SIZES = [4, 6, 8, 10, 12] as const;
export type ClockSize = (typeof CLOCK_SIZES)[number];

/** A progress clock: a deadline, a danger closing in, or effort towards a goal. */
export interface Clock {
  segments: ClockSize;
  filled: number;
  /** What fills it, e.g. "The ritual completes". */
  label: string;
}

export interface RewardItem {
  id: string;
  name: string;
  template: string | null;
  articleId: string | null;
  quantity: number;
}

/** What completing the quest is worth; offered to the session that completes it. */
export interface Rewards {
  xp: number | null;
  coins: { currencyId: string; amount: number }[];
  items: RewardItem[];
}

export const EMPTY_REWARDS: Rewards = { xp: null, coins: [], items: [] };

export const hasRewards = (r: Rewards | null) => !!r && (r.xp !== null || r.coins.length > 0 || r.items.length > 0);

export const FRONT_KINDS = ["campaign", "adventure"] as const;
export type FrontKind = (typeof FRONT_KINDS)[number];
export const FRONT_KIND_LABELS = wordedLabels(FRONT_KINDS, "frontKind");

export const FRONT_STATUSES = ["active", "averted", "doom"] as const;
export type FrontStatus = (typeof FRONT_STATUSES)[number];
export const FRONT_STATUS_LABELS = wordedLabels(FRONT_STATUSES, "frontStatus");

/** A grim portent: a step the threat takes when the party doesn't stop it. */
export interface Portent {
  id: string;
  text: string;
  happened: boolean;
}

/**
 * A front (Dungeon World): a threat pursuing its goal off-screen, its grim
 * portents in order and the impending doom if nobody stops it. Quests can
 * sit under a front.
 */
export interface FrontData {
  id: string;
  campaignId: string;
  name: string;
  kind: FrontKind;
  status: FrontStatus;
  threat: string;
  doom: string;
  portents: Portent[];
  clock: Clock | null;
  /** The clock fills once per portent (full marks the next one, then it starts over), instead of once in all. */
  clockPerPortent: boolean;
  color: string | null;
  sortOrder: number;
  version: number;
}

/** The fields of a quest a client sees. */
export interface QuestData {
  id: string;
  campaignId: string;
  parentId: string | null;
  title: string;
  kind: QuestKind;
  status: QuestStatus;
  priority: QuestPriority;
  summary: string;
  bodyDocumentId: string | null;
  giver: ArticleRef | null;
  articleLinks: QuestLink[];
  objectives: Objective[];
  frontId: string | null;
  clues: Clue[];
  clock: Clock | null;
  rewards: Rewards | null;
  /** In-world days (the shared day count), each optional. */
  startDay: number | null;
  deadlineDay: number | null;
  endDay: number | null;
  sortOrder: number;
  version: number;
}

/** What a quest's in-world date means on a given day. */
export const QUEST_DAY_KINDS = ["start", "deadline", "end"] as const;
export type QuestDayKind = (typeof QUEST_DAY_KINDS)[number];
export const QUEST_DAY_LABELS = wordedLabels(QUEST_DAY_KINDS, "questDay");

/** A quest as a calendar row: enough to label and link it. */
export interface BriefQuest {
  id: string;
  campaignId: string;
  campaignName: string;
  title: string;
  status: QuestStatus;
  kind: QuestKind;
  startDay: number | null;
  deadlineDay: number | null;
  endDay: number | null;
}

/** A dragged node's place on the quest map. */
export interface MapPoint {
  x: number;
  y: number;
}
