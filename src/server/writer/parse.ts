/**
 * Strict parsers for Campaign Writer JSON coming from clients (pure; relative
 * imports only). Each returns the cleaned value or throws ParseError (a 400)
 * with a plain-language message. The read* helpers are lenient: they turn a
 * stored value (possibly from an older shape) into a complete one.
 */
import { ParseError } from "../calendars/parse";
import type { Problem } from "../calendars/engine";
import type { MessageKey } from "../../i18n/messages";
import type { ArticleRef } from "../quests/types";
import {
  BEAT_ROLES,
  EMPTY_PREP,
  EMPTY_SETUP,
  LINK_KINDS,
  MICE_TYPES,
  NODE_KINDS,
  NODE_STATUSES,
  REVIEW_OUTCOMES,
  SECRET_STATES,
  STATUS_KINDS,
  THREAD_KINDS,
  THREAD_STATUSES,
  type BeatRole,
  type CampaignSetup,
  type MiceType,
  type NodeKind,
  type NodeStatus,
  type OutlineLink,
  type ReviewOutcome,
  type Secret,
  type SessionPrep,
  type StatusKind,
  type ThreadKind,
  type ThreadStatus,
} from "./types";

export const MAX_TITLE = 160;
export const MAX_SYNOPSIS = 4000;
export const MAX_LINE = 500;
export const MAX_LONG = 4000;
export const MAX_LINKS = 50;
export const MAX_TRUTHS = 12;
export const MAX_SAFETY = 40;
export const MAX_SECRETS = 30;
export const MAX_LOCATIONS = 20;
export const MAX_NPCS = 30;
export const MAX_REVIEW = 200;
export const MAX_MOVES = 500;

const fail = (message: string | Problem): never => {
  throw new ParseError(message);
};

/** What a user can run into carries a `campaign` Problem; shape errors stay English. */
const problem = (key: MessageKey<"campaign">, params?: Problem["params"]): Problem => ({ ns: "campaign", key, params });

const obj = (v: unknown, what: string): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : fail(`${what} is missing or malformed.`);

const list = (v: unknown, what: string, max: number): unknown[] => {
  if (!Array.isArray(v)) return fail(`${what} must be a list.`);
  if (v.length > max) fail(`${what} can have at most ${max} items.`);
  return v;
};

export const ident = (v: unknown, what: string): string => (typeof v === "string" && v.length > 0 && v.length <= 64 ? v : fail(`${what} needs a valid id.`));

const optionalIdent = (v: unknown, what: string): string | null => (v === null || v === undefined || v === "" ? null : ident(v, what));

const text = (v: unknown, what: string, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : v == null ? "" : fail(`${what} must be text.`));

const oneOf = <T extends string>(values: readonly T[], v: unknown, what: string): T => ((values as readonly unknown[]).includes(v) ? (v as T) : fail(`${what} isn't valid.`));

const lines = (v: unknown, what: string, max: number, maxLength = MAX_LINE): string[] =>
  list(v ?? [], what, max)
    .map((l) => text(l, what, maxLength))
    .filter(Boolean);

export function parseNodeTitle(v: unknown): string {
  const title = text(v, "The title", MAX_TITLE);
  return title || fail(problem("problem.nodeTitle"));
}

export const parseSynopsis = (v: unknown) => text(v, "The synopsis", MAX_SYNOPSIS);
export const parseChangeNote = (v: unknown) => text(v, "What changed", MAX_LONG);
export const parseNodeKind = (v: unknown): NodeKind => oneOf(NODE_KINDS, v, "The outline item's type");
export const parseNodeStatus = (v: unknown): NodeStatus => oneOf(NODE_STATUSES, v, "The status");
export const parseOptionalId = optionalIdent;

/** Linked quests and fronts, one entry each. */
export function parseOutlineLinks(v: unknown): OutlineLink[] {
  const seen = new Set<string>();
  return list(v ?? [], "Links", MAX_LINKS).flatMap((l, i) => {
    const x = obj(l, `Link ${i + 1}`);
    const link = { kind: oneOf(LINK_KINDS, x.kind, `Link ${i + 1}'s type`), id: ident(x.id, `Link ${i + 1}`) };
    const key = `${link.kind}:${link.id}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [link];
  });
}

export function parseSortIndex(v: unknown): number {
  return Number.isSafeInteger(v) && (v as number) >= 0 && (v as number) <= 1_000_000 ? (v as number) : fail("The position isn't valid.");
}

export interface OutlineMove {
  id: string;
  parentId: string | null;
  sortOrder: number;
}

/** A batch of outline moves (drag and drop, indent, reorder). */
export function parseMoves(v: unknown): OutlineMove[] {
  const seen = new Set<string>();
  return list(v, "The moves", MAX_MOVES).map((m, i) => {
    const x = obj(m, `Move ${i + 1}`);
    const id = ident(x.id, `Move ${i + 1}`);
    if (seen.has(id)) fail("An item can move only once at a time.");
    seen.add(id);
    return { id, parentId: optionalIdent(x.parentId, `Move ${i + 1}'s parent`), sortOrder: parseSortIndex(x.sortOrder) };
  });
}

export function parseThreadName(v: unknown): string {
  const name = text(v, "The thread's name", MAX_TITLE);
  return name || fail(problem("problem.threadName"));
}

export const parseThreadKind = (v: unknown): ThreadKind => oneOf(THREAD_KINDS, v, "The thread's type");
export const parseThreadStatus = (v: unknown): ThreadStatus => oneOf(THREAD_STATUSES, v, "The thread's status");
export const parseMiceType = (v: unknown): MiceType | null => (v === null || v === undefined || v === "" ? null : oneOf(MICE_TYPES, v, "The MICE type"));
export const parseThreadSummary = (v: unknown) => text(v, "The summary", MAX_LONG);
export const parseBeatRole = (v: unknown): BeatRole => oneOf(BEAT_ROLES, v, "The beat's role");
export const parseBeatNote = (v: unknown) => text(v, "The note", MAX_LINE);

const HEX = /^#[0-9a-f]{6}$/i;

export function parseColor(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  return typeof v === "string" && HEX.test(v) ? v.toLowerCase() : fail("The color must be a #RRGGBB color.");
}

const ref = (v: unknown, what: string): ArticleRef => {
  const x = obj(v, what);
  return { template: ident(x.template, what), articleId: ident(x.articleId, what) };
};

/** The campaign's one-page setup; only the keys sent change (merged over `current`). */
export function parseSetup(v: unknown, current: CampaignSetup): CampaignSetup {
  const x = obj(v, "The campaign setup");
  const out = { ...current };
  if ("pitch" in x) out.pitch = text(x.pitch, "The pitch", MAX_LONG);
  if ("truths" in x) out.truths = lines(x.truths, "Campaign truths", MAX_TRUTHS);
  if ("lines" in x) out.lines = lines(x.lines, "Lines", MAX_SAFETY, 200);
  if ("veils" in x) out.veils = lines(x.veils, "Veils", MAX_SAFETY, 200);
  if ("guidesHidden" in x) out.guidesHidden = x.guidesHidden === true;
  if ("sessionZero" in x) {
    const checks = obj(x.sessionZero, "The session zero checklist");
    const entries = Object.entries(checks);
    if (entries.length > 50) fail("The session zero checklist is too long.");
    out.sessionZero = Object.fromEntries(entries.filter(([key]) => key.length > 0 && key.length <= 64).map(([key, done]) => [key, done === true]));
  }
  return out;
}

export function parseSecrets(v: unknown): Secret[] {
  const out = list(v ?? [], "Secrets", MAX_SECRETS)
    .map((s, i): Secret => {
      const x = obj(s, `Secret ${i + 1}`);
      return { id: ident(x.id, `Secret ${i + 1}`), text: text(x.text, "A secret", MAX_LINE), state: x.state === undefined ? "unused" : oneOf(SECRET_STATES, x.state, `Secret ${i + 1}'s state`) };
    })
    .filter((s) => s.text);
  if (new Set(out.map((s) => s.id)).size !== out.length) fail("Two secrets share the same id.");
  return out;
}

/** A session's prep; only the keys sent change (merged over `current`). */
export function parsePrep(v: unknown, current: SessionPrep): SessionPrep {
  const x = obj(v, "The session prep");
  const out = { ...current };
  if ("reviewCharacters" in x) out.reviewCharacters = text(x.reviewCharacters, "Character notes", MAX_LONG);
  if ("strongStart" in x) out.strongStart = text(x.strongStart, "The strong start", MAX_LONG);
  if ("monsters" in x) out.monsters = text(x.monsters, "Monsters", MAX_LONG);
  if ("rewards" in x) out.rewards = text(x.rewards, "Rewards", MAX_LONG);
  if ("locations" in x) out.locations = lines(x.locations, "Locations", MAX_LOCATIONS, 1000);
  if ("secrets" in x) out.secrets = parseSecrets(x.secrets);
  if ("npcs" in x) {
    const byId = new Map<string, ArticleRef>();
    list(x.npcs ?? [], "NPCs", MAX_NPCS).forEach((n, i) => {
      const r = ref(n, `NPC ${i + 1}`);
      byId.set(r.articleId, r);
    });
    out.npcs = [...byId.values()];
  }
  return out;
}

export const parseStatusKind = (v: unknown): StatusKind => (v === undefined ? "world" : oneOf(STATUS_KINDS, v, "The change's type"));

export function parseStatusText(v: unknown): string {
  const t = text(v, "The change", MAX_LONG);
  return t || fail(problem("problem.statusText"));
}

export const parseSubject = (v: unknown): ArticleRef | null => (v === null || v === undefined ? null : ref(v, "Who or what changed"));

export interface ReviewScene {
  id: string;
  outcome: ReviewOutcome;
  changeNote: string;
}

export interface ReviewInput {
  scenes: ReviewScene[];
  /** Secret id → revealed (true) or not. */
  secrets: Record<string, boolean>;
  entries: { kind: StatusKind; subject: ArticleRef | null; text: string }[];
}

/** A session's "what happened?" review. */
export function parseReview(v: unknown): ReviewInput {
  const x = obj(v, "The review");
  const seen = new Set<string>();
  const scenes = list(x.scenes ?? [], "Scenes", MAX_REVIEW).map((s, i) => {
    const y = obj(s, `Scene ${i + 1}`);
    const id = ident(y.id, `Scene ${i + 1}`);
    if (seen.has(id)) fail("A scene appears twice in the review.");
    seen.add(id);
    return { id, outcome: oneOf(REVIEW_OUTCOMES, y.outcome, `Scene ${i + 1}'s outcome`), changeNote: parseChangeNote(y.changeNote) };
  });
  const secretsIn = obj(x.secrets ?? {}, "The secrets");
  if (Object.keys(secretsIn).length > MAX_SECRETS) fail(problem("problem.maxSecrets", { max: MAX_SECRETS }));
  const secrets = Object.fromEntries(Object.entries(secretsIn).map(([id, revealed]) => [ident(id, "A secret"), revealed === true]));
  const entries = list(x.entries ?? [], "World changes", 50)
    .map((e, i) => {
      const y = obj(e, `Change ${i + 1}`);
      return { kind: parseStatusKind(y.kind), subject: parseSubject(y.subject), text: text(y.text, "A change", MAX_LONG) };
    })
    .filter((e) => e.text);
  return { scenes, secrets, entries };
}

const asRecord = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const asStrings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : []);
const asString = (v: unknown): string => (typeof v === "string" ? v : "");

/** A stored campaign setup, completed with defaults. */
export function readSetup(raw: unknown): CampaignSetup {
  const x = asRecord(raw);
  const zero = asRecord(x.sessionZero);
  return {
    ...EMPTY_SETUP,
    pitch: asString(x.pitch),
    truths: asStrings(x.truths),
    lines: asStrings(x.lines),
    veils: asStrings(x.veils),
    guidesHidden: x.guidesHidden === true,
    sessionZero: Object.fromEntries(Object.entries(zero).map(([k, done]) => [k, done === true])),
  };
}

/** A stored session prep, completed with defaults. */
export function readPrep(raw: unknown): SessionPrep {
  const x = asRecord(raw);
  const secrets = Array.isArray(x.secrets)
    ? x.secrets.flatMap((s): Secret[] => {
        const y = asRecord(s);
        const state = (SECRET_STATES as readonly unknown[]).includes(y.state) ? (y.state as Secret["state"]) : "unused";
        return typeof y.id === "string" && typeof y.text === "string" ? [{ id: y.id, text: y.text, state }] : [];
      })
    : [];
  const npcs = Array.isArray(x.npcs)
    ? x.npcs.flatMap((n): ArticleRef[] => {
        const y = asRecord(n);
        return typeof y.template === "string" && typeof y.articleId === "string" ? [{ template: y.template, articleId: y.articleId }] : [];
      })
    : [];
  return {
    ...EMPTY_PREP,
    reviewCharacters: asString(x.reviewCharacters),
    strongStart: asString(x.strongStart),
    monsters: asString(x.monsters),
    rewards: asString(x.rewards),
    locations: asStrings(x.locations),
    secrets,
    npcs,
    reviewed: x.reviewed === true,
  };
}
