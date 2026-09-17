import { NextResponse } from "next/server";
import { eq, and, isNull, like } from "drizzle-orm";
import { db } from "@/server/db/client";
import { people } from "@/server/db/schema";
import { ensureDefaultWorld } from "@/server/world/default-world";

export async function GET(request: Request) {
  const worldId = await ensureDefaultWorld();
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const conditions = [eq(people.worldId, worldId), isNull(people.deletedAt)];
  if (q) conditions.push(like(people.name, `%${q}%`));
  const rows = await db.query.people.findMany({ where: and(...conditions) });
  return NextResponse.json({ people: rows });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "A name is required." }, { status: 400 });

  const worldId = await ensureDefaultWorld();
  const houseId = typeof body?.houseId === "string" && body.houseId ? body.houseId : null;
  const [created] = await db
    .insert(people)
    .values({ worldId, name, description: typeof body?.description === "string" ? body.description : "", houseId })
    .returning();
  return NextResponse.json({ person: created }, { status: 201 });
}
