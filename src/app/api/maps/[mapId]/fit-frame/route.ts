import { NextResponse } from "next/server";
import { fitFrameToImages } from "@/server/maps/fit-frame";

/** Grows the map frame to cover every layer image; `frame` is null when it already did. */
export async function POST(_request: Request, { params }: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await params;
  const frame = await fitFrameToImages(mapId);
  return NextResponse.json({ frame });
}
