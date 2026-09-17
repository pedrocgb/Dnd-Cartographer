import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/server/db/client";
import { territorySeats, territories, markers } from "@/server/db/schema";
import { ensureDefaultWorld } from "@/server/world/default-world";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const territoryId = searchParams.get("territoryId");
  const markerId = searchParams.get("markerId");
  if (!territoryId && !markerId) {
    return NextResponse.json({ error: "territoryId or markerId is required." }, { status: 400 });
  }
  const rows = await db.query.territorySeats.findMany({
    where: territoryId ? eq(territorySeats.territoryId, territoryId) : eq(territorySeats.markerId, markerId!),
  });
  return NextResponse.json({ seats: rows });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const territoryId = typeof body?.territoryId === "string" ? body.territoryId : "";
  const markerId = typeof body?.markerId === "string" ? body.markerId : "";
  const role = body?.role === "capital" || body?.role === "seat" ? body.role : null;

  if (!territoryId) return NextResponse.json({ error: "territoryId is required." }, { status: 400 });
  if (!markerId) return NextResponse.json({ error: "markerId is required." }, { status: 400 });
  if (!role) return NextResponse.json({ error: "role must be 'capital' or 'seat'." }, { status: 400 });

  const territory = await db.query.territories.findFirst({ where: eq(territories.id, territoryId) });
  if (!territory) return NextResponse.json({ error: "Territory not found." }, { status: 404 });
  const marker = await db.query.markers.findFirst({ where: eq(markers.id, markerId) });
  if (!marker) return NextResponse.json({ error: "Marker not found." }, { status: 404 });

  const existing = await db.query.territorySeats.findFirst({
    where: and(eq(territorySeats.territoryId, territoryId), eq(territorySeats.role, role)),
  });
  if (existing) {
    const [updated] = await db.update(territorySeats).set({ markerId, updatedAt: new Date() }).where(eq(territorySeats.id, existing.id)).returning();
    return NextResponse.json({ seat: updated });
  }

  const worldId = await ensureDefaultWorld();
  const [created] = await db.insert(territorySeats).values({ worldId, territoryId, markerId, role }).returning();
  return NextResponse.json({ seat: created }, { status: 201 });
}
