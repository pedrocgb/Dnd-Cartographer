import { NextResponse } from "next/server";
import { createMapAssetUpload, InvalidImageError } from "@/server/assets/create-upload";
import { firstLayer } from "@/server/layers/layers";
import { notInWorld } from "@/server/world/guards";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await params;
  const denied = await notInWorld("maps", mapId, "Map not found.");
  if (denied) return denied;

  if (!request.body) {
    return NextResponse.json({ error: "Missing upload body." }, { status: 400 });
  }

  try {
    // Map-level upload (the empty-map prompt) targets the top layer.
    const layer = await firstLayer(mapId);
    const result = await createMapAssetUpload(mapId, request.body, layer.id);
    return NextResponse.json(result, { status: 202 });
  } catch (err) {
    if (err instanceof InvalidImageError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[upload]", err);
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}
