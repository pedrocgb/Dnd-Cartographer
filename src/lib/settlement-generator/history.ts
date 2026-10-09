import { parseStoredHistory, type HistoryItem } from "../tool-history";
import type { GeneratedSettlement } from "./generate";

/** A settlement in the recent list. */
export interface HistoryEntry extends HistoryItem {
  settlement: GeneratedSettlement;
}

/** A stored history; empty when missing or corrupt. Entries of an unknown shape are dropped. */
export function parseHistory(raw: string | null): HistoryEntry[] {
  return parseStoredHistory<HistoryEntry>(raw, (e) => {
    const s = e.settlement as Partial<GeneratedSettlement> | undefined;
    return s?.version === 1 && typeof s.name === "string" && typeof s.summary === "string";
  });
}
