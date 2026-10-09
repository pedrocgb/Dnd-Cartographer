import { RELATION_GROUPS, type RelationGroup } from "./types";

/**
 * Relationship boards: hand-placed cards (records, whose real relations are
 * drawn between them, and free notes). Pure (vitest imports it).
 */

export const MAX_BOARD_NAME = 80;
export const MAX_BOARD_CARDS = 400;
export const MAX_NOTE_TEXT = 1000;
export const NOTE_PREFIX = "note:";
/** An arrow without a color of its own. */
export const ARROW_DEFAULT = "#9ca3af";
export const MAX_BOARD_ARROWS = 600;
export const MAX_BOARD_GROUPS = 100;
export const MAX_GROUP_TITLE = 60;
export const MAX_ARROW_LABEL = 80;
export const ARROW_DIRS = ["one", "both", "none"] as const;
export type ArrowDir = (typeof ARROW_DIRS)[number];
/** The card side an arrow end is pinned to (its dot): top, right, bottom, left. */
export const ARROW_SIDES = ["t", "r", "b", "l"] as const;
export type ArrowSide = (typeof ARROW_SIDES)[number];
export const isArrowSide = (v: unknown): v is ArrowSide => ARROW_SIDES.includes(v as ArrowSide);
/** A note's size bounds (px); without a stored size it's NOTE_DEFAULT_W x NOTE_DEFAULT_H. */
export const NOTE_MIN_W = 140;
export const NOTE_MAX_W = 480;
export const NOTE_MIN_H = 80;
export const NOTE_MAX_H = 600;
export const NOTE_DEFAULT_W = 190;
export const NOTE_DEFAULT_H = 110;
const COORD_LIMIT = 1_000_000;

export interface BoardCard {
  /** A record id, or `note:<uuid>` for a free note. */
  id: string;
  x: number;
  y: number;
  text?: string;
  color?: string;
  /** A note's width and minimum height (it still grows to fit its text). */
  w?: number;
  h?: number;
}

/** A user-drawn arrow between two cards (a flowchart link, not a relation). */
export interface BoardArrow {
  id: string;
  from: string;
  to: string;
  /** The sides it was drawn between; without them it runs between the cards' facing edges. */
  fromSide?: ArrowSide;
  toSide?: ArrowSide;
  label?: string;
  /** Arrowheads: at `to` ("one", the default), at both ends, or none. */
  dir?: ArrowDir;
  color?: string;
  dashed?: boolean;
}

/** Cards framed together under a title; the frame fits around them. A card is in one group at most. */
export interface BoardGroup {
  id: string;
  title: string;
  members: string[];
}

export interface BoardFilters {
  groups?: RelationGroup[];
  showDerived?: boolean;
  attitudeMode?: boolean;
}

export const isNoteId = (id: string) => id.startsWith(NOTE_PREFIX);

/** A finite number rounded into [min, max], or undefined. */
const size = (v: unknown, min: number, max: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : undefined);

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const shortId = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 64;

const coord = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(-COORD_LIMIT, Math.min(COORD_LIMIT, Math.round(v))) : 0);

/** A trimmed board name, or null when empty. */
export function sanitizeBoardName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim().slice(0, MAX_BOARD_NAME);
  return name || null;
}

/** Known card shapes only, one per id, capped; null when `raw` isn't a list. */
export function sanitizeBoardCards(raw: unknown): BoardCard[] | null {
  if (!Array.isArray(raw)) return null;
  const seen = new Set<string>();
  const cards: BoardCard[] = [];
  for (const item of raw) {
    if (cards.length >= MAX_BOARD_CARDS) break;
    if (!item || typeof item !== "object") continue;
    const c = item as Record<string, unknown>;
    if (typeof c.id !== "string" || !c.id || c.id.length > 64 || seen.has(c.id)) continue;
    seen.add(c.id);
    const card: BoardCard = { id: c.id, x: coord(c.x), y: coord(c.y) };
    if (isNoteId(c.id)) {
      card.text = typeof c.text === "string" ? c.text.slice(0, MAX_NOTE_TEXT) : "";
      if (typeof c.color === "string" && HEX_COLOR.test(c.color)) card.color = c.color.toLowerCase();
      const w = size(c.w, NOTE_MIN_W, NOTE_MAX_W);
      const h = size(c.h, NOTE_MIN_H, NOTE_MAX_H);
      if (w !== undefined) card.w = w;
      if (h !== undefined) card.h = h;
    }
    cards.push(card);
  }
  return cards;
}

/** Known arrow shapes only, one per id and per pair of cards, capped; null when `raw` isn't a list. */
export function sanitizeBoardArrows(raw: unknown): BoardArrow[] | null {
  if (!Array.isArray(raw)) return null;
  const ids = new Set<string>();
  const pairs = new Set<string>();
  const arrows: BoardArrow[] = [];
  for (const item of raw) {
    if (arrows.length >= MAX_BOARD_ARROWS) break;
    if (!item || typeof item !== "object") continue;
    const a = item as Record<string, unknown>;
    if (!shortId(a.id) || !shortId(a.from) || !shortId(a.to) || a.from === a.to || ids.has(a.id)) continue;
    const pair = [a.from, a.to].sort().join("|");
    if (pairs.has(pair)) continue;
    ids.add(a.id);
    pairs.add(pair);
    const arrow: BoardArrow = { id: a.id, from: a.from, to: a.to };
    if (isArrowSide(a.fromSide)) arrow.fromSide = a.fromSide;
    if (isArrowSide(a.toSide)) arrow.toSide = a.toSide;
    const label = typeof a.label === "string" ? a.label.trim().slice(0, MAX_ARROW_LABEL) : "";
    if (label) arrow.label = label;
    if (ARROW_DIRS.includes(a.dir as ArrowDir)) arrow.dir = a.dir as ArrowDir;
    if (typeof a.color === "string" && HEX_COLOR.test(a.color)) arrow.color = a.color.toLowerCase();
    if (a.dashed === true) arrow.dashed = true;
    arrows.push(arrow);
  }
  return arrows;
}

/** Known group shapes only: each card in one group, groups without cards dropped, capped; null when `raw` isn't a list. */
export function sanitizeBoardGroups(raw: unknown): BoardGroup[] | null {
  if (!Array.isArray(raw)) return null;
  const ids = new Set<string>();
  const grouped = new Set<string>();
  const groups: BoardGroup[] = [];
  for (const item of raw) {
    if (groups.length >= MAX_BOARD_GROUPS) break;
    if (!item || typeof item !== "object") continue;
    const g = item as Record<string, unknown>;
    if (!shortId(g.id) || ids.has(g.id) || !Array.isArray(g.members)) continue;
    const members = [...new Set(g.members.filter((m): m is string => shortId(m) && !grouped.has(m)))].slice(0, MAX_BOARD_CARDS);
    if (!members.length) continue;
    ids.add(g.id);
    members.forEach((m) => grouped.add(m));
    groups.push({ id: g.id, title: typeof g.title === "string" ? g.title.trim().slice(0, MAX_GROUP_TITLE) : "", members });
  }
  return groups;
}

/** Known filter keys only; null when `raw` isn't an object. */
export function sanitizeBoardFilters(raw: unknown): BoardFilters | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const f = raw as Record<string, unknown>;
  const out: BoardFilters = {};
  if (Array.isArray(f.groups)) {
    const known = new Set<string>(RELATION_GROUPS.map((g) => g.key));
    out.groups = [...new Set(f.groups.filter((g): g is RelationGroup => typeof g === "string" && known.has(g)))];
  }
  if (typeof f.showDerived === "boolean") out.showDerived = f.showDerived;
  if (typeof f.attitudeMode === "boolean") out.attitudeMode = f.attitudeMode;
  return out;
}

/** Parses a stored JSON column, falling back when it's unreadable. */
export function parseBoardJson<T>(text: string, sanitize: (raw: unknown) => T | null, fallback: T): T {
  try {
    return sanitize(JSON.parse(text)) ?? fallback;
  } catch {
    return fallback;
  }
}
