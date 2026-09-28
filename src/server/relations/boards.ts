import { RELATION_GROUPS, type RelationGroup } from "./types";

/**
 * Relationship boards: hand-placed cards (records, whose real relations are
 * drawn between them, and free notes). Pure (vitest imports it).
 */

export const MAX_BOARD_NAME = 80;
export const MAX_BOARD_CARDS = 400;
export const MAX_NOTE_TEXT = 1000;
export const NOTE_PREFIX = "note:";
const COORD_LIMIT = 1_000_000;

export interface BoardCard {
  /** A record id, or `note:<uuid>` for a free note. */
  id: string;
  x: number;
  y: number;
  text?: string;
  color?: string;
}

export interface BoardFilters {
  groups?: RelationGroup[];
  showDerived?: boolean;
  attitudeMode?: boolean;
}

export const isNoteId = (id: string) => id.startsWith(NOTE_PREFIX);

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
      if (typeof c.color === "string" && /^#[0-9a-f]{6}$/i.test(c.color)) card.color = c.color.toLowerCase();
    }
    cards.push(card);
  }
  return cards;
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
