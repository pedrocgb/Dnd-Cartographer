import { NextResponse } from "next/server";
import { reorderLayers } from "@/server/layers/layers";
import { notInWorld } from "@/server/world/guards";

/** Body: { ids: string[] } — the full layer list, top of the list first. */
export async function PUT(request: Request, { params }: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await params;
  const denied = await notInWorld("maps", mapId, "Map not found.");
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  if (!Array.isArray(body?.ids) || !body.ids.every((id: unknown) => typeof id === "string")) {
    return NextResponse.json({ error: "ids must be an array of layer ids." }, { status: 400 });
  }
  await reorderLayers(mapId, body.ids);
  return NextResponse.json({ ok: true });
}
