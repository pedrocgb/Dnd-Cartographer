/** The recent results an Advanced Tool keeps in this browser: newest first, limited and expiring. */
export interface HistoryItem {
  id: string;
  createdAt: number;
}

export const HISTORY_MAX = 10;
/** Entries older than this are dropped. */
export const HISTORY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Without expired entries. */
export function pruneHistory<T extends HistoryItem>(entries: T[], now: number): T[] {
  return entries.filter((e) => now - e.createdAt < HISTORY_TTL_MS);
}

/** Newest first; past the limit, the oldest entry makes room. */
export function addToHistory<T extends HistoryItem>(entries: T[], entry: T, now: number): T[] {
  return [entry, ...pruneHistory(entries, now)].slice(0, HISTORY_MAX);
}

/** A stored history, keeping only entries `isEntry` accepts; empty when missing or corrupt. */
export function parseStoredHistory<T extends HistoryItem>(raw: string | null, isEntry: (e: Record<string, unknown>) => boolean): T[] {
  try {
    const parsed: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e): e is T => typeof e?.id === "string" && typeof e.createdAt === "number" && isEntry(e));
  } catch {
    return [];
  }
}
