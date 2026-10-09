import type { relationshipBoards } from "@/server/db/schema";
import { parseBoardJson, sanitizeBoardArrows, sanitizeBoardCards, sanitizeBoardFilters, sanitizeBoardGroups, type BoardArrow, type BoardCard, type BoardFilters, type BoardGroup } from "./boards";

export { sanitizeBoardArrows, sanitizeBoardCards, sanitizeBoardFilters, sanitizeBoardGroups, sanitizeBoardName } from "./boards";

export interface ClientBoard {
  id: string;
  name: string;
  cards: BoardCard[];
  arrows: BoardArrow[];
  groups: BoardGroup[];
  filters: BoardFilters;
}

export function toClientBoard(row: typeof relationshipBoards.$inferSelect): ClientBoard {
  return {
    id: row.id,
    name: row.name,
    cards: parseBoardJson(row.cards, sanitizeBoardCards, []),
    arrows: parseBoardJson(row.arrows, sanitizeBoardArrows, []),
    groups: parseBoardJson(row.groups, sanitizeBoardGroups, []),
    filters: parseBoardJson(row.filters, sanitizeBoardFilters, {}),
  };
}
