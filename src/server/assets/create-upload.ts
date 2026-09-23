import { createWriteStream } from "node:fs";
import { rename, rm, stat, mkdir } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { maps, mapAssets, processingJobs } from "../db/schema";
import { tempUploadPath, originalPath, originalKey } from "./paths";
import { validateImageFile, InvalidImageError } from "./validate";

export { InvalidImageError };

/**
 * Streams the request body straight to a temp file on disk (never buffers
 * the whole upload in memory), validates it, moves it into managed
 * storage, then records the asset + its first processing job. The asset
 * becomes `layerId`'s image once the worker has tiled it.
 */
export async function createMapAssetUpload(
  mapId: string,
  body: ReadableStream<Uint8Array>,
  layerId: string
): Promise<{ assetId: string; jobId: string }> {
  const map = await db.query.maps.findFirst({ where: eq(maps.id, mapId) });
  if (!map) {
    throw new InvalidImageError(`Unknown map: ${mapId}`);
  }

  const uploadId = crypto.randomUUID();
  const tempPath = tempUploadPath(uploadId);
  await mkdir(path.dirname(tempPath), { recursive: true });

  await pipeline(Readable.fromWeb(body as never), createWriteStream(tempPath));
  const { size } = await stat(tempPath);

  let validated;
  try {
    validated = await validateImageFile(tempPath, size);
  } catch (err) {
    await rm(tempPath, { force: true });
    throw err;
  }

  const previousAsset = map.currentAssetId
    ? await db.query.mapAssets.findFirst({ where: eq(mapAssets.id, map.currentAssetId) })
    : undefined;
  const generation = (previousAsset?.generation ?? 0) + 1;

  const assetId = crypto.randomUUID();
  const finalPath = originalPath(assetId, validated.extension);
  await mkdir(path.dirname(finalPath), { recursive: true });
  await rename(tempPath, finalPath);

  const [asset] = await db
    .insert(mapAssets)
    .values({
      id: assetId,
      mapId,
      layerId,
      originalKey: originalKey(assetId, validated.extension),
      width: validated.width,
      height: validated.height,
      byteSize: size,
      state: "queued",
      generation,
    })
    .returning({ id: mapAssets.id });

  const [job] = await db
    .insert(processingJobs)
    .values({ assetId: asset.id, generation, state: "queued" })
    .returning({ id: processingJobs.id });

  return { assetId: asset.id, jobId: job.id };
}
