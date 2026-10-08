import { NextResponse } from "next/server";
import { errorResponse } from "@/i18n/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { mapLayers } from "@/server/db/schema";
import { createMapAssetUpload, InvalidImageError } from "@/server/assets/create-upload";
import { findLayer } from "@/server/layers/layers";
import { notInWorld } from "@/server/world/guards";

export const runtime = "nodejs";

/** Uploads (or replaces) this layer's image; tiling runs in the worker. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const denied = await notInWorld("map_layers", id, "layerNotFound");
  if (denied) return denied;
  const layer = await findLayer(id);
  if (!layer) return errorResponse("layerNotFound", 404);
  if (!request.body) return errorResponse("missingUpload", 400);

  try {
    const result = await createMapAssetUpload(layer.mapId, request.body, layer.id);
    return NextResponse.json(result, { status: 202 });
  } catch (err) {
    if (err instanceof InvalidImageError) {
      return errorResponse(err.key, 400, undefined, err.params);
    }
    console.error("[layer upload]", err);
    return errorResponse("uploadFailed", 500);
  }
}

/** Detaches the image from the layer (asset files are kept, same as a replaced image). */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const denied = await notInWorld("map_layers", id, "layerNotFound");
  if (denied) return denied;
  const layer = await findLayer(id);
  if (!layer) return errorResponse("layerNotFound", 404);
  await db.update(mapLayers).set({ assetId: null, updatedAt: new Date() }).where(eq(mapLayers.id, id));
  return NextResponse.json({ ok: true });
}
