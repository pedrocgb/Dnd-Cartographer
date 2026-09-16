import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { mapAssets } from "@/server/db/schema";
import { resolveAssetPath } from "@/server/storage/storage-adapter";

export const runtime = "nodejs";

const CONTENT_TYPES: Record<string, string> = {
  ".dzi": "application/xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ assetId: string; path: string[] }> }
) {
  const { assetId, path: pathSegments } = await params;

  if (pathSegments.some((segment) => segment === "..")) {
    return NextResponse.json({ error: "Invalid path." }, { status: 400 });
  }

  const asset = await db.query.mapAssets.findFirst({ where: eq(mapAssets.id, assetId) });
  if (!asset) {
    return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  }

  const relativeKey = `${assetId}/g${asset.generation}/${pathSegments.join("/")}`;
  const filePath = resolveAssetPath("tiles", relativeKey);

  try {
    const data = await readFile(filePath);
    const ext = path.extname(filePath);
    return new NextResponse(data, {
      headers: {
        "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Tile not found." }, { status: 404 });
  }
}
