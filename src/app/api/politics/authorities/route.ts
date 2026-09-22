import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/server/db/client";
import { authorityAssignments, territories, people, organizations } from "@/server/db/schema";
import { ensureDefaultWorld } from "@/server/world/default-world";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const territoryId = searchParams.get("territoryId");
  const holderType = searchParams.get("holderType");

  if (territoryId) {
    const rows = await db.query.authorityAssignments.findMany({ where: eq(authorityAssignments.territoryId, territoryId) });
    return NextResponse.json({ authorities: rows });
  }

  // No territoryId — used by the People tab's "Authority" grouping, which
  // needs every person-held authority across the whole world at once rather
  // than one territory at a time.
  const worldId = await ensureDefaultWorld();
  const conditions = [eq(authorityAssignments.worldId, worldId)];
  if (holderType === "person" || holderType === "organization") conditions.push(eq(authorityAssignments.holderType, holderType));
  const rows = await db.query.authorityAssignments.findMany({ where: and(...conditions) });
  return NextResponse.json({ authorities: rows });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const territoryId = typeof body?.territoryId === "string" ? body.territoryId : "";
  const holderType = body?.holderType === "person" || body?.holderType === "organization" ? body.holderType : null;
  const holderId = typeof body?.holderId === "string" ? body.holderId : "";
  const role = typeof body?.role === "string" ? body.role.trim() : "";

  if (!territoryId) return NextResponse.json({ error: "territoryId is required." }, { status: 400 });
  if (!holderType) return NextResponse.json({ error: "holderType must be 'person' or 'organization'." }, { status: 400 });
  if (!holderId) return NextResponse.json({ error: "holderId is required." }, { status: 400 });
  if (!role) return NextResponse.json({ error: "A role is required." }, { status: 400 });

  const territory = await db.query.territories.findFirst({ where: eq(territories.id, territoryId) });
  if (!territory) return NextResponse.json({ error: "Territory not found." }, { status: 404 });

  const holder =
    holderType === "person"
      ? await db.query.people.findFirst({ where: eq(people.id, holderId) })
      : await db.query.organizations.findFirst({ where: eq(organizations.id, holderId) });
  if (!holder) return NextResponse.json({ error: `${holderType === "person" ? "Person" : "Organization"} not found.` }, { status: 404 });

  const worldId = await ensureDefaultWorld();
  const [created] = await db
    .insert(authorityAssignments)
    .values({
      worldId,
      territoryId,
      holderType,
      holderId,
      role,
      title: typeof body?.title === "string" ? body.title : "",
      notes: typeof body?.notes === "string" ? body.notes : "",
    })
    .returning();
  return NextResponse.json({ authority: created }, { status: 201 });
}
