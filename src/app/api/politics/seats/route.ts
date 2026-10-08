import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/server/db/client";
import { territorySeats, territories } from "@/server/db/schema";
import { rowInWorld } from "@/server/world/guards";
import { requireWorldId } from "@/server/world/active-world";
import { errorResponse } from "@/i18n/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const territoryId = searchParams.get("territoryId");
  const markerId = searchParams.get("markerId");
  if (!territoryId && !markerId) {
    return errorResponse("seatFilterRequired", 400);
  }
  const rows = await db.query.territorySeats.findMany({
    where: and(eq(territorySeats.worldId, await requireWorldId()), territoryId ? eq(territorySeats.territoryId, territoryId) : eq(territorySeats.markerId, markerId!)),
  });
  return NextResponse.json({ seats: rows });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const territoryId = typeof body?.territoryId === "string" ? body.territoryId : "";
  const markerId = typeof body?.markerId === "string" ? body.markerId : "";
  const role = body?.role === "capital" || body?.role === "seat" ? body.role : null;

  if (!territoryId) return errorResponse("territoryIdRequired", 400);
  if (!markerId) return errorResponse("markerIdRequired", 400);
  if (!role) return errorResponse("seatRoleInvalid", 400);

  const worldId = await requireWorldId();
  const territory = await db.query.territories.findFirst({ where: and(eq(territories.id, territoryId), eq(territories.worldId, worldId)) });
  if (!territory) return errorResponse("territoryNotFound", 404);
  if (!(await rowInWorld("markers", markerId, worldId))) return errorResponse("markerNotFound", 404);

  const existing = await db.query.territorySeats.findFirst({
    where: and(eq(territorySeats.territoryId, territoryId), eq(territorySeats.role, role)),
  });
  if (existing) {
    const [updated] = await db.update(territorySeats).set({ markerId, updatedAt: new Date() }).where(eq(territorySeats.id, existing.id)).returning();
    return NextResponse.json({ seat: updated });
  }

  const [created] = await db.insert(territorySeats).values({ worldId, territoryId, markerId, role }).returning();
  return NextResponse.json({ seat: created }, { status: 201 });
}
