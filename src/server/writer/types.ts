/**
 * Campaign Writer shapes (pure data; relative imports only). A campaign's
 * story is an outline of arcs > chapters > scenes; threads follow promises,
 * setups and MICE threads across scenes; sessions get a Lazy DM prep and a
 * "what happened" review that feeds the campaign status log.
 */
import type { ArticleRef } from "../quests/types";

export const NODE_KINDS = ["arc", "chapter", "scene"] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

export const NODE_KIND_LABELS: Record<NodeKind, string> = { arc: "Arc", chapter: "Chapter", scene: "Scene" };

/** The kind a node's children are (scenes have none). */
export const CHILD_KIND: Record<NodeKind, NodeKind | null> = { arc: "chapter", chapter: "scene", scene: null };

export const NODE_STATUSES = ["planned", "ready", "played", "changed", "skipped"] as const;
export type NodeStatus = (typeof NODE_STATUSES)[number];

export const NODE_STATUS_LABELS: Record<NodeStatus, string> = {
  planned: "Idea",
  ready: "Ready to play",
  played: "Played",
  changed: "Played, changed",
  skipped: "Cut",
};

export const NODE_STATUS_HINTS: Record<NodeStatus, string> = {
  planned: "Still an idea: brainstorm and shape it",
  ready: "Prepped: only what you'll use at the table",
  played: "Happened at the table as written",
  changed: "Happened, but the table took it somewhere else",
  skipped: "Cut: it won't happen (kept for reference)",
};

export const LINK_KINDS = ["quest", "front"] as const;
export type OutlineLinkKind = (typeof LINK_KINDS)[number];

export interface OutlineLink {
  kind: OutlineLinkKind;
  id: string;
}

export interface OutlineNode {
  id: string;
  campaignId: string;
  parentId: string | null;
  kind: NodeKind;
  title: string;
  synopsis: string;
  documentId: string | null;
  beatTemplate: string | null;
  beatKey: string | null;
  status: NodeStatus;
  plannedSessionId: string | null;
  playedSessionId: string | null;
  changeNote: string;
  links: OutlineLink[];
  sortOrder: number;
  version: number;
}

export const THREAD_KINDS = ["promise", "chekhov", "mice"] as const;
export type ThreadKind = (typeof THREAD_KINDS)[number];

export const THREAD_KIND_LABELS: Record<ThreadKind, string> = { promise: "Promise", chekhov: "Setup (Chekhov)", mice: "MICE thread" };

export const THREAD_KIND_HINTS: Record<ThreadKind, string> = {
  promise: "Something the story promises the players (a mystery, a rival, a looming war) that it must pay off",
  chekhov: "A detail you plant now so it can matter later: the gun on the wall must go off",
  mice: "A thread that opens and closes: Milieu (a place), Inquiry (a question), Character (a change), Event (a disruption). First opened, last closed",
};

export const MICE_TYPES = ["milieu", "inquiry", "character", "event"] as const;
export type MiceType = (typeof MICE_TYPES)[number];

export const MICE_LABELS: Record<MiceType, string> = { milieu: "Milieu", inquiry: "Inquiry", character: "Character", event: "Event" };

export const MICE_HINTS: Record<MiceType, string> = {
  milieu: "Opens when they enter a place, closes when they leave it",
  inquiry: "Opens with a question, closes when it's answered",
  character: "Opens with someone unhappy with who they are, closes when they change",
  event: "Opens when the status quo breaks, closes with a new order",
};

export const THREAD_STATUSES = ["open", "paid", "dropped"] as const;
export type ThreadStatus = (typeof THREAD_STATUSES)[number];

export const THREAD_STATUS_LABELS: Record<ThreadStatus, string> = { open: "Open", paid: "Paid off", dropped: "Dropped" };

export const BEAT_ROLES = ["setup", "progress", "payoff"] as const;
export type BeatRole = (typeof BEAT_ROLES)[number];

/** What each role is called for each kind of thread. */
export const BEAT_ROLE_LABELS: Record<ThreadKind, Record<BeatRole, string>> = {
  promise: { setup: "Promise", progress: "Progress", payoff: "Payoff" },
  chekhov: { setup: "Planted", progress: "Reminder", payoff: "Fired" },
  mice: { setup: "Opens", progress: "Develops", payoff: "Closes" },
};

export interface PlotThread {
  id: string;
  campaignId: string;
  name: string;
  kind: ThreadKind;
  miceType: MiceType | null;
  status: ThreadStatus;
  questId: string | null;
  summary: string;
  color: string | null;
  sortOrder: number;
  version: number;
}

export interface ThreadBeat {
  id: string;
  threadId: string;
  nodeId: string;
  role: BeatRole;
  note: string;
}

/** The campaign's one-page setup (Sly Flourish): pitch, truths, session zero and safety lines. */
export interface CampaignSetup {
  pitch: string;
  truths: string[];
  /** Session zero checklist: item key → done. */
  sessionZero: Record<string, boolean>;
  /** Content that never appears. */
  lines: string[];
  /** Content that happens off-screen. */
  veils: string[];
  /** The writer's guide hints are hidden. */
  guidesHidden: boolean;
}

export const EMPTY_SETUP: CampaignSetup = { pitch: "", truths: [], sessionZero: {}, lines: [], veils: [], guidesHidden: false };

export const SECRET_STATES = ["unused", "revealed", "carried"] as const;
export type SecretState = (typeof SECRET_STATES)[number];

/** A Lazy DM secret or clue: one sentence, not tied to where it's found. */
export interface Secret {
  id: string;
  text: string;
  state: SecretState;
}

/** A session's prep, following the Lazy DM's eight steps. */
export interface SessionPrep {
  reviewCharacters: string;
  strongStart: string;
  secrets: Secret[];
  locations: string[];
  npcs: ArticleRef[];
  monsters: string;
  rewards: string;
  /** The session was reviewed ("what happened?"). */
  reviewed: boolean;
}

export const EMPTY_PREP: SessionPrep = { reviewCharacters: "", strongStart: "", secrets: [], locations: [], npcs: [], monsters: "", rewards: "", reviewed: false };

export const STATUS_KINDS = ["world", "faction", "npc", "place", "other"] as const;
export type StatusKind = (typeof STATUS_KINDS)[number];

export const STATUS_KIND_LABELS: Record<StatusKind, string> = { world: "World", faction: "Faction", npc: "NPC", place: "Place", other: "Other" };

export interface StatusEntry {
  id: string;
  campaignId: string;
  sessionId: string | null;
  worldDay: number | null;
  kind: StatusKind;
  subject: ArticleRef | null;
  text: string;
  createdAt: string;
}

/** What a session review sets on a planned scene. "later" keeps it for the next session. */
export const REVIEW_OUTCOMES = ["played", "changed", "later", "skipped"] as const;
export type ReviewOutcome = (typeof REVIEW_OUTCOMES)[number];

export const REVIEW_OUTCOME_LABELS: Record<ReviewOutcome, string> = { played: "Played", changed: "Changed", later: "Not reached", skipped: "Cut" };

export interface HealthWarning {
  /** Stable key (for React lists). */
  key: string;
  level: "warn" | "info";
  text: string;
  /** What it's about, to open it. */
  target: { kind: "thread" | "quest" | "node"; id: string };
}
