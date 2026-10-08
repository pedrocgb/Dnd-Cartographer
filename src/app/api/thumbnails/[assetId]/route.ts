import { NextResponse } from "next/server";
import { errorResponse } from "@/i18n/server";
import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { mapAssets } from "@/server/db/schema";
import { thumbnailPath } from "@/server/assets/paths";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const asset = await db.query.mapAssets.findFirst({ where: eq(mapAssets.id, assetId) });
  if (!asset || !asset.thumbnailKey) {
    return errorResponse("thumbnailNotFound", 404);
  }

  try {
    const data = await readFile(thumbnailPath(asset.id, asset.generation));
    return new NextResponse(data, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return errorResponse("thumbnailNotFound", 404);
  }
}
