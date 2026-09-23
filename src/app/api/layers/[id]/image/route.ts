import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { mapLayers } from "@/server/db/schema";
import { createMapAssetUpload, InvalidImageError } from "@/server/assets/create-upload";
import { findLayer } from "@/server/layers/layers";

export const runtime = "nodejs";

/** Uploads (or replaces) this layer's image; tiling runs in the worker. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const layer = await findLayer(id);
  if (!layer) return NextResponse.json({ error: "Layer not found." }, { status: 404 });
  if (!request.body) return NextResponse.json({ error: "Missing upload body." }, { status: 400 });

  try {
    const result = await createMapAssetUpload(layer.mapId, request.body, layer.id);
    return NextResponse.json(result, { status: 202 });
  } catch (err) {
    if (err instanceof InvalidImageError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[layer upload]", err);
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}

/** Detaches the image from the layer (asset files are kept, same as a replaced image). */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const layer = await findLayer(id);
  if (!layer) return NextResponse.json({ error: "Layer not found." }, { status: 404 });
  await db.update(mapLayers).set({ assetId: null, updatedAt: new Date() }).where(eq(mapLayers.id, id));
  return NextResponse.json({ ok: true });
}
