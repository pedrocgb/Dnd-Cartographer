import { NextResponse } from "next/server";
import { buildMarkerLinks } from "@/server/politics/links";
import { notInWorld } from "@/server/world/guards";
import { requireWorldId } from "@/server/world/active-world";

export async function GET(_request: Request, { params }: { params: Promise<{ markerId: string }> }) {
  const { markerId } = await params;
  const denied = await notInWorld("markers", markerId, "Marker not found.");
  if (denied) return denied;
  const links = await buildMarkerLinks(await requireWorldId(), markerId);
  return NextResponse.json({ links });
}
