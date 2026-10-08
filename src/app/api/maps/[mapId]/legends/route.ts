import { NextResponse } from "next/server";
import { listLegends } from "@/server/legends/legends";
import { notInWorld } from "@/server/world/guards";

/** Every layer legend of the map (a legend can show on other layers too). */
export async function GET(_request: Request, { params }: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await params;
  const denied = await notInWorld("maps", mapId, "mapNotFound");
  if (denied) return denied;
  return NextResponse.json({ legends: await listLegends(mapId) });
}
