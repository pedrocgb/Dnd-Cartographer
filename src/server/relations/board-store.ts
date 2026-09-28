import type { relationshipBoards } from "@/server/db/schema";
import { parseBoardJson, sanitizeBoardCards, sanitizeBoardFilters, type BoardCard, type BoardFilters } from "./boards";

export { sanitizeBoardCards, sanitizeBoardFilters, sanitizeBoardName } from "./boards";

export interface ClientBoard {
  id: string;
  name: string;
  cards: BoardCard[];
  filters: BoardFilters;
}

export function toClientBoard(row: typeof relationshipBoards.$inferSelect): ClientBoard {
  return {
    id: row.id,
    name: row.name,
    cards: parseBoardJson(row.cards, sanitizeBoardCards, []),
    filters: parseBoardJson(row.filters, sanitizeBoardFilters, {}),
  };
}
