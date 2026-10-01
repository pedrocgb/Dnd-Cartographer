import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../db/client";
import { articleFolderItems, articleFolders, articles, organizations, people, territories } from "../db/schema";

/**
 * The Articles page's own folders (the "Folders" tab). Folder rules (names,
 * colors, nesting) are the maps list's, see server/maps/folders.ts; this is
 * the DB side. Filing an article never touches the article's own row.
 */

export const MAX_FOLDER_ITEMS_PER_REQUEST = 500;

export function worldArticleFolders(worldId: string) {
  return db.select({ id: articleFolders.id, parentId: articleFolders.parentId }).from(articleFolders).where(eq(articleFolders.worldId, worldId));
}

/** The folder when it's one of this world's, else null. */
export async function findArticleFolder(worldId: string, id: string) {
  const [folder] = await db
    .select()
    .from(articleFolders)
    .where(and(eq(articleFolders.id, id), eq(articleFolders.worldId, worldId)));
  return folder ?? null;
}

/** Of `ids`, those naming a live (not trashed) article of this world, in any of the four article tables. */
export async function liveArticleIds(worldId: string, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const found = await Promise.all([
    db.select({ id: articles.id }).from(articles).where(and(inArray(articles.id, ids), eq(articles.worldId, worldId), isNull(articles.deletedAt))),
    db.select({ id: people.id }).from(people).where(and(inArray(people.id, ids), eq(people.worldId, worldId), isNull(people.deletedAt))),
    db.select({ id: organizations.id }).from(organizations).where(and(inArray(organizations.id, ids), eq(organizations.worldId, worldId), isNull(organizations.deletedAt))),
    db.select({ id: territories.id }).from(territories).where(and(inArray(territories.id, ids), eq(territories.worldId, worldId), isNull(territories.deletedAt))),
  ]);
  return new Set(found.flat().map((r) => r.id));
}

/** A request's `articleIds`: a non-empty, deduplicated string list (capped), or null. */
export function parseArticleIds(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_FOLDER_ITEMS_PER_REQUEST) return null;
  if (!raw.every((id) => typeof id === "string" && id)) return null;
  return [...new Set(raw as string[])];
}

/** Every membership row of the world's folders (trashed articles included: the client hides them, a restore shows them again). */
export function listArticleFolderItems(worldId: string) {
  return db
    .select({ folderId: articleFolderItems.folderId, articleId: articleFolderItems.articleId })
    .from(articleFolderItems)
    .innerJoin(articleFolders, eq(articleFolderItems.folderId, articleFolders.id))
    .where(eq(articleFolders.worldId, worldId));
}

/** Files articles in a folder; ones already in it are left as they are. */
export async function addToFolder(folderId: string, articleIds: string[]) {
  if (articleIds.length === 0) return;
  await db
    .insert(articleFolderItems)
    .values(articleIds.map((articleId) => ({ folderId, articleId })))
    .onConflictDoNothing();
}
