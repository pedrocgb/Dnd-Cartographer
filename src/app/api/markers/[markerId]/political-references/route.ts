import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/server/db/client";
import { markers, people, organizations, politicalReferences } from "@/server/db/schema";
import { ensureDefaultWorld } from "@/server/world/default-world";

export async function GET(_request: Request, { params }: { params: Promise<{ markerId: string }> }) {
  const { markerId } = await params;
  const rows = await db.query.politicalReferences.findMany({
    where: and(eq(politicalReferences.sourceType, "marker"), eq(politicalReferences.sourceId, markerId)),
  });
  return NextResponse.json({ references: rows });
}

export async function POST(request: Request, { params }: { params: Promise<{ markerId: string }> }) {
  const { markerId } = await params;
  const marker = await db.query.markers.findFirst({ where: eq(markers.id, markerId) });
  if (!marker) return NextResponse.json({ error: "Marker not found." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const targetType = body?.targetType === "person" || body?.targetType === "organization" ? body.targetType : null;
  const targetId = typeof body?.targetId === "string" ? body.targetId : "";
  if (!targetType) return NextResponse.json({ error: "targetType must be 'person' or 'organization'." }, { status: 400 });
  if (!targetId) return NextResponse.json({ error: "targetId is required." }, { status: 400 });

  const target =
    targetType === "person"
      ? await db.query.people.findFirst({ where: eq(people.id, targetId) })
      : await db.query.organizations.findFirst({ where: eq(organizations.id, targetId) });
  if (!target) return NextResponse.json({ error: `${targetType === "person" ? "Person" : "Organization"} not found.` }, { status: 404 });

  const worldId = await ensureDefaultWorld();
  const [created] = await db
    .insert(politicalReferences)
    .values({
      worldId,
      sourceType: "marker",
      sourceId: markerId,
      targetType,
      targetId,
      label: typeof body?.label === "string" ? body.label.trim() : "",
    })
    .returning();
  return NextResponse.json({ reference: created }, { status: 201 });
}
