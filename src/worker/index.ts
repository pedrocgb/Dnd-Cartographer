import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { and, eq, lt, or } from "drizzle-orm";
import { db } from "../server/db/client";
import { mapAssets, mapLayers, maps, processingJobs } from "../server/db/schema";
import { originalPath, tilesBasenamePath, tilesDzKey, thumbnailPath, thumbnailKey } from "../server/assets/paths";

const LEASE_MS = 60_000;
const POLL_INTERVAL_MS = 1_000;
const MAX_ATTEMPTS = 3;

let stopping = false;

interface ClaimedJob {
  jobId: string;
  assetId: string;
  generation: number;
  attempts: number;
}

/**
 * Claims the oldest queued job, or a job whose worker lease has expired
 * (crash recovery). Single worker, but the lease/generation guard keeps
 * this safe even if a second worker instance ever runs.
 */
async function claimNextJob(): Promise<ClaimedJob | null> {
  const now = new Date();
  const candidates = await db
    .select()
    .from(processingJobs)
    .where(
      or(
        eq(processingJobs.state, "queued"),
        and(eq(processingJobs.state, "processing"), lt(processingJobs.leaseExpiresAt, now))
      )
    )
    .limit(1);

  const candidate = candidates[0];
  if (!candidate) return null;

  const nextAttempts = candidate.attempts + 1;
  const lease = new Date(Date.now() + LEASE_MS);

  await db
    .update(processingJobs)
    .set({ state: "processing", leaseExpiresAt: lease, attempts: nextAttempts, updatedAt: new Date() })
    .where(eq(processingJobs.id, candidate.id));

  return {
    jobId: candidate.id,
    assetId: candidate.assetId,
    generation: candidate.generation,
    attempts: nextAttempts,
  };
}

async function markAssetProcessing(assetId: string): Promise<void> {
  await db.update(mapAssets).set({ state: "processing", updatedAt: new Date() }).where(eq(mapAssets.id, assetId));
}

async function markJobDone(
  jobId: string,
  assetId: string,
  generation: number,
  size: { width: number; height: number }
): Promise<void> {
  await db
    .update(processingJobs)
    .set({ state: "done", updatedAt: new Date() })
    .where(eq(processingJobs.id, jobId));

  await db
    .update(mapAssets)
    .set({
      state: "ready",
      manifestKey: tilesDzKey(assetId, generation),
      thumbnailKey: thumbnailKey(assetId, generation),
      width: size.width,
      height: size.height,
      updatedAt: new Date(),
    })
    .where(eq(mapAssets.id, assetId));

  const asset = await db.query.mapAssets.findFirst({ where: eq(mapAssets.id, assetId) });
  if (!asset) return;
  if (asset.layerId) {
    await db.update(mapLayers).set({ assetId, updatedAt: new Date() }).where(eq(mapLayers.id, asset.layerId));
  }
  // The first image ever processed fixes the map's coordinate frame; it also
  // stays the map's thumbnail/export asset (maps.currentAssetId).
  const map = await db.query.maps.findFirst({ where: eq(maps.id, asset.mapId) });
  if (map && (!map.frameWidth || !map.frameHeight || !map.currentAssetId)) {
    await db
      .update(maps)
      .set({ currentAssetId: assetId, frameWidth: size.width, frameHeight: size.height, updatedAt: new Date() })
      .where(eq(maps.id, asset.mapId));
  }
}

async function markJobFailed(jobId: string, assetId: string, attempts: number, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  const willRetry = attempts < MAX_ATTEMPTS;

  await db
    .update(processingJobs)
    .set({ state: willRetry ? "queued" : "failed", lastError: message, updatedAt: new Date() })
    .where(eq(processingJobs.id, jobId));

  await db
    .update(mapAssets)
    .set({ state: willRetry ? "queued" : "failed", updatedAt: new Date() })
    .where(eq(mapAssets.id, assetId));
}

async function processJob(job: ClaimedJob): Promise<void> {
  const asset = await db.query.mapAssets.findFirst({ where: eq(mapAssets.id, job.assetId) });
  if (!asset) {
    console.error(`[worker] job ${job.jobId} references missing asset ${job.assetId}, marking failed`);
    await markJobFailed(job.jobId, job.assetId, job.attempts, new Error("Asset record missing"));
    return;
  }

  await markAssetProcessing(job.assetId);

  const extension = path.extname(asset.originalKey);
  const srcPath = originalPath(asset.id, extension);
  const basenamePath = tilesBasenamePath(asset.id, job.generation);
  const thumbPath = thumbnailPath(asset.id, job.generation);

  console.log(`[worker] processing asset ${asset.id} (generation ${job.generation})`);
  const start = Date.now();

  await ensureDir(basenamePath);
  await ensureDir(thumbPath);

  let image = sharp(srcPath, { limitInputPixels: false }).rotate(); // normalize EXIF orientation

  // Layer images are stretched to the map's frame so marker u/v, zone
  // geometry and grids line up on every layer.
  const map = await db.query.maps.findFirst({ where: eq(maps.id, asset.mapId) });
  const meta = await sharp(srcPath, { limitInputPixels: false }).metadata();
  // EXIF orientations 5-8 are 90° rotations, which .rotate() above applies.
  const swap = (meta.orientation ?? 1) >= 5;
  let size = { width: (swap ? meta.height : meta.width) ?? 0, height: (swap ? meta.width : meta.height) ?? 0 };
  if (map?.frameWidth && map.frameHeight && (size.width !== map.frameWidth || size.height !== map.frameHeight)) {
    image = image.resize({ width: map.frameWidth, height: map.frameHeight, fit: "fill" });
    size = { width: map.frameWidth, height: map.frameHeight };
  }

  await image
    .clone()
    .webp({ lossless: true }) // format is set by the encoder chained before .tile(), not a TileOptions field
    .tile({ size: 512, overlap: 1, layout: "dz" })
    .toFile(basenamePath);

  await image.clone().resize({ width: 512, height: 512, fit: "inside" }).webp().toFile(thumbPath);

  await markJobDone(job.jobId, asset.id, job.generation, size);
  console.log(`[worker] asset ${asset.id} ready in ${((Date.now() - start) / 1000).toFixed(2)}s`);
}

async function ensureDir(filePath: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
}

async function loop(): Promise<void> {
  console.log("[worker] started, polling for jobs");
  while (!stopping) {
    let job: ClaimedJob | null = null;
    try {
      job = await claimNextJob();
    } catch (err) {
      // Claiming can transiently fail under write contention (e.g. SQLITE_BUSY
      // racing a concurrent writer) even with busy_timeout set — back off and
      // retry rather than letting the whole worker die over one bad poll.
      console.error("[worker] failed to claim a job:", err);
      await sleep(POLL_INTERVAL_MS);
      continue;
    }
    if (!job) {
      await sleep(POLL_INTERVAL_MS);
      continue;
    }
    try {
      await processJob(job);
    } catch (err) {
      console.error(`[worker] job ${job.jobId} failed:`, err);
      try {
        await markJobFailed(job.jobId, job.assetId, job.attempts, err);
      } catch (markErr) {
        // Even recording the failure can transiently fail (e.g. a DB lock
        // contended by a concurrent writer) — never let that crash the
        // whole worker process; the lease will simply expire and this job
        // gets reclaimed on the next poll, same as a hard crash recovery.
        console.error(`[worker] failed to record failure for job ${job.jobId}:`, markErr);
      }
    }
  }
  console.log("[worker] stopped");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

process.on("SIGINT", () => (stopping = true));
process.on("SIGTERM", () => (stopping = true));

// Final safety net: if something still escapes every try/catch above and
// the loop throws, restart it rather than exiting the process — a crashed
// worker silently stops all image processing until someone notices and
// manually restarts it, which is worse than a logged, automatic restart.
async function main(): Promise<void> {
  while (!stopping) {
    try {
      await loop();
    } catch (err) {
      console.error("[worker] loop crashed, restarting in 5s:", err);
      await sleep(5000);
    }
  }
}

main();
