import { parseStoredHistory, type HistoryItem } from "../tool-history";
import type { GeneratedCharacter } from "./generate";

export { HISTORY_MAX, HISTORY_TTL_MS, addToHistory, pruneHistory } from "../tool-history";

/** A character in the recent list; `personId` once a Character article was made from it. */
export interface HistoryEntry extends HistoryItem {
  character: GeneratedCharacter;
  personId?: string;
}

export function markArticleCreated(entries: HistoryEntry[], id: string, personId: string): HistoryEntry[] {
  return entries.map((e) => (e.id === id ? { ...e, personId } : e));
}

/** A stored history; empty when missing or corrupt. */
export function parseHistory(raw: string | null): HistoryEntry[] {
  return parseStoredHistory<HistoryEntry>(
    raw,
    (e) => typeof (e.character as GeneratedCharacter | undefined)?.name === "string" && (e.personId === undefined || typeof e.personId === "string")
  );
}
