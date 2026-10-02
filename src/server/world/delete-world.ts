/**
 * Deletes a world for good: every row tied to it (see delete-plan.ts), then
 * its files — map images (originals, tiles, thumbnails), portraits and the
 * article images its documents use. Rows go in one transaction; files after
 * it commits, like the Trash purge.
 */
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "../db/client";
import { articles, mapAssets, organizations, people, processingJobs, richDocuments, territories, worlds } from "../db/schema";
import { resolveAssetPath } from "../storage/storage-adapter";
import { articleImagePath } from "../assets/article-image-upload";
import { ARTICLE_IMAGE_URL_PREFIX } from "../documents/rich-attrs";
import { portraitFiles, removeFiles } from "../trash/purge";
import { worldDeletePlan } from "./delete-plan";
import { worldRowsFilter } from "./guards";

const IMAGE_KEY = new RegExp(`${ARTICLE_IMAGE_URL_PREFIX.replace(/\//g, "\\/")}([0-9a-f-]{36}\\.webp)`, "g");
const imageKeys = (texts: string[]) => new Set(texts.flatMap((t) => [...t.matchAll(IMAGE_KEY)].map((m) => m[1])));

/** The files of a world: found before its rows go. Article images another world also uses are kept. */
async function worldFiles(worldId: string): Promise<string[]> {
  const assets = await db.select({ id: mapAssets.id }).from(mapAssets).where(worldRowsFilter("map_assets", worldId));
  const owners = async (table: typeof people | typeof organizations | typeof territories | typeof articles) => (await db.select({ id: table.id }).from(table).where(eq(table.worldId, worldId))).map((r) => r.id);
  const docs = await db.select({ text: richDocuments.jsonText }).from(richDocuments).where(eq(richDocuments.worldId, worldId));
  const elsewhere = await db.select({ text: richDocuments.jsonText }).from(richDocuments).where(ne(richDocuments.worldId, worldId));
  const shared = imageKeys(elsewhere.map((d) => d.text));
  return [
    ...assets.flatMap(({ id }) => [resolveAssetPath("originals", id), resolveAssetPath("tiles", id), resolveAssetPath("thumbnails", id)]),
    ...portraitFiles("person", await owners(people)),
    ...portraitFiles("organization", await owners(organizations)),
    ...portraitFiles("territory", await owners(territories)),
    ...portraitFiles("article", await owners(articles)),
    ...[...imageKeys(docs.map((d) => d.text))].filter((key) => !shared.has(key)).map(articleImagePath),
  ];
}

/** True while one of the world's map images is being processed by the worker (deleting now would race it). */
export async function worldIsBusy(worldId: string): Promise<boolean> {
  const assets = db.select({ id: mapAssets.id }).from(mapAssets).where(worldRowsFilter("map_assets", worldId));
  const busy = await db
    .select({ id: processingJobs.id })
    .from(processingJobs)
    .where(and(inArray(processingJobs.assetId, assets), eq(processingJobs.state, "processing")))
    .limit(1);
  return busy.length > 0;
}

export async function deleteWorld(worldId: string): Promise<void> {
  const files = await worldFiles(worldId);
  await db.transaction(async (tx) => {
    for (const step of worldDeletePlan()) await tx.run(sql`DELETE FROM ${sql.identifier(step.table)} WHERE ${worldRowsFilter(step.table, worldId)}`);
    await tx.delete(worlds).where(eq(worlds.id, worldId));
  });
  await removeFiles(files);
}
