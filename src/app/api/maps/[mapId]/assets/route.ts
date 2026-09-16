import { NextResponse } from "next/server";
import { createMapAssetUpload, InvalidImageError } from "@/server/assets/create-upload";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await params;

  if (!request.body) {
    return NextResponse.json({ error: "Missing upload body." }, { status: 400 });
  }

  try {
    const result = await createMapAssetUpload(mapId, request.body);
    return NextResponse.json(result, { status: 202 });
  } catch (err) {
    if (err instanceof InvalidImageError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[upload]", err);
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}
