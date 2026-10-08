import { NextResponse } from "next/server";
import { errorResponse } from "@/i18n/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { mapAssets, processingJobs } from "@/server/db/schema";
import { notInWorld } from "@/server/world/guards";

export async function POST(_request: Request, { params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const denied = await notInWorld("map_assets", assetId, "assetNotFound");
  if (denied) return denied;
  const asset = await db.query.mapAssets.findFirst({ where: eq(mapAssets.id, assetId) });

  if (!asset) {
    return errorResponse("assetNotFound", 404);
  }
  if (asset.state !== "failed") {
    return errorResponse("assetRetryOnlyFailed", 409, undefined, { state: asset.state });
  }

  await db.update(mapAssets).set({ state: "queued", updatedAt: new Date() }).where(eq(mapAssets.id, assetId));
  const [job] = await db
    .insert(processingJobs)
    .values({ assetId, generation: asset.generation, state: "queued" })
    .returning({ id: processingJobs.id });

  return NextResponse.json({ jobId: job.id }, { status: 202 });
}
