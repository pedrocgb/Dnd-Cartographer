import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { campaigns } from "@/server/db/schema";
import { requireWorldId } from "@/server/world/active-world";
import { safeJson } from "@/server/calendars/parse";
import { badRequest, calendarErrorResponse, notFound, readBody } from "@/server/calendars/respond";
import { campaignOf } from "@/server/sessions/store";
import { MAX_MAP_NODES, parseMapPositions } from "@/server/quests/parse";
import type { MapPoint } from "@/server/quests/types";

type RouteContext = { params: Promise<{ id: string }> };

/** Where the DM placed the campaign's quest map nodes (the rest use the automatic layout). */
export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const campaign = await campaignOf(await requireWorldId(), id);
  if (!campaign) return notFound("Campaign not found.");
  return NextResponse.json({ positions: safeJson<Record<string, MapPoint>>(campaign.questMap, {}) });
}

/** Merges `{ positions: { nodeId: {x, y} | null } }` into the saved layout; null forgets a node's spot. */
export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const campaign = await campaignOf(await requireWorldId(), id);
  if (!campaign) return notFound("Campaign not found.");
  const body = await readBody(request);
  if (!body) return badRequest("Invalid request body.");
  try {
    const changes = body.reset === true ? null : parseMapPositions(body.positions);
    const merged: Record<string, MapPoint> = changes ? { ...safeJson<Record<string, MapPoint>>(campaign.questMap, {}) } : {};
    for (const [key, point] of Object.entries(changes ?? {})) {
      if (point) merged[key] = point;
      else delete merged[key];
    }
    if (Object.keys(merged).length > MAX_MAP_NODES) return badRequest(`The map can hold at most ${MAX_MAP_NODES} placed nodes.`);
    await db.update(campaigns).set({ questMap: JSON.stringify(merged), updatedAt: new Date() }).where(eq(campaigns.id, id));
    return NextResponse.json({ positions: merged });
  } catch (error) {
    return calendarErrorResponse(error);
  }
}
