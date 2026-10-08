import { NextResponse } from "next/server";
import { createMapAssetUpload, InvalidImageError } from "@/server/assets/create-upload";
import { firstLayer } from "@/server/layers/layers";
import { notInWorld } from "@/server/world/guards";
import { errorResponse } from "@/i18n/server";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await params;
  const denied = await notInWorld("maps", mapId, "mapNotFound");
  if (denied) return denied;

  if (!request.body) {
    return errorResponse("missingUpload", 400);
  }

  try {
    // Map-level upload (the empty-map prompt) targets the top layer.
    const layer = await firstLayer(mapId);
    const result = await createMapAssetUpload(mapId, request.body, layer.id);
    return NextResponse.json(result, { status: 202 });
  } catch (err) {
    if (err instanceof InvalidImageError) {
      return errorResponse(err.key, 400, undefined, err.params);
    }
    console.error("[upload]", err);
    return errorResponse("uploadFailed", 500);
  }
}
