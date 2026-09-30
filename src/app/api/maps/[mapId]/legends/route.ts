import { NextResponse } from "next/server";
import { listLegends } from "@/server/legends/legends";

/** Every layer legend of the map (a legend can show on other layers too). */
export async function GET(_request: Request, { params }: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await params;
  return NextResponse.json({ legends: await listLegends(mapId) });
}
