import type { articles } from "@/server/db/schema";
import { parseTags } from "./tags";

export const MAX_TITLE_LENGTH = 200;

/** API response shape: the stored tags JSON replaced by the parsed list. */
export function toClientArticle(row: typeof articles.$inferSelect) {
  return { ...row, tags: parseTags(row.tags) };
}
