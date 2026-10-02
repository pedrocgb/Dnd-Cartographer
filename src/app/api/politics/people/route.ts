import { NextResponse } from "next/server";
import { sanitizeInfo } from "@/server/articles/info-fields";
import { personInfoSet } from "@/server/articles/info-sets";
import { eq, and, isNull, like } from "drizzle-orm";
import { db } from "@/server/db/client";
import { people } from "@/server/db/schema";
import { requireWorldId } from "@/server/world/active-world";
import { foreignIdResponse, idsInWorld } from "@/server/world/guards";

export async function GET(request: Request) {
  const worldId = await requireWorldId();
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

  const worldId = await requireWorldId();
  // A Character by default; "player" makes a Player Character.
  const kind = body?.kind === "player" ? "player" : "npc";
  const houseId = typeof body?.houseId === "string" && body.houseId ? body.houseId : null;
  const status = typeof body?.status === "string" && body.status ? body.status : null;
  if (!(await idsInWorld(worldId, [["organizations", houseId]]))) return foreignIdResponse();
  const [created] = await db
    .insert(people)
    .values({ worldId, name, kind, houseId, status, info: JSON.stringify(sanitizeInfo(personInfoSet(kind), body?.info) ?? {}) })
    .returning();
  return NextResponse.json({ person: created }, { status: 201 });
}
