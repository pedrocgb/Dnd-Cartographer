import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { markers } from "@/server/db/schema";
import { toClientMarker } from "@/server/markers/tag-registry";

const OFFSET = 0.02;

export async function POST(_request: Request, { params }: { params: Promise<{ markerId: string }> }) {
  const { markerId } = await params;
  const source = await db.query.markers.findFirst({ where: eq(markers.id, markerId) });
  if (!source) {
    return NextResponse.json({ error: "Marker not found." }, { status: 404 });
  }

  const [duplicate] = await db
    .insert(markers)
    .values({
      mapId: source.mapId,
      name: `${source.name} (copy)`,
      u: Math.min(1, source.u + OFFSET),
      v: Math.min(1, source.v + OFFSET),
      iconKey: source.iconKey,
      color: source.color,
      backgroundColor: source.backgroundColor,
      outlineColor: source.outlineColor,
      backgroundShape: source.backgroundShape,
      category: source.category,
      categoryId: source.categoryId,
      linkedMapId: source.linkedMapId,
      statusTags: source.statusTags,
      environment: source.environment,
      ownership: source.ownership,
    })
    .returning();

  return NextResponse.json({ marker: toClientMarker(duplicate) }, { status: 201 });
}
