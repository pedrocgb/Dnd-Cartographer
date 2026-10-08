import { NextResponse } from "next/server";
import { fitFrameToImages } from "@/server/maps/fit-frame";
import { notInWorld } from "@/server/world/guards";

/** Grows the map frame to cover every layer image; `frame` is null when it already did. */
export async function POST(_request: Request, { params }: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await params;
  const denied = await notInWorld("maps", mapId, "mapNotFound");
  if (denied) return denied;
  const frame = await fitFrameToImages(mapId);
  return NextResponse.json({ frame });
}
