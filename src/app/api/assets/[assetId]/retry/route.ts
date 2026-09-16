import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { mapAssets, processingJobs } from "@/server/db/schema";

export async function POST(_request: Request, { params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const asset = await db.query.mapAssets.findFirst({ where: eq(mapAssets.id, assetId) });

  if (!asset) {
    return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  }
  if (asset.state !== "failed") {
    return NextResponse.json({ error: `Only failed assets can be retried (state: ${asset.state}).` }, { status: 409 });
  }

  await db.update(mapAssets).set({ state: "queued", updatedAt: new Date() }).where(eq(mapAssets.id, assetId));
  const [job] = await db
    .insert(processingJobs)
    .values({ assetId, generation: asset.generation, state: "queued" })
    .returning({ id: processingJobs.id });

  return NextResponse.json({ jobId: job.id }, { status: 202 });
}
