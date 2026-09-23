import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { mapGrids, mapLayers, mapLines, mapTexts, markers, zoneRegions, zones } from "@/server/db/schema";
import { findLayer, listLayerRows } from "@/server/layers/layers";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const layer = await findLayer(id);
  if (!layer) return NextResponse.json({ error: "Layer not found." }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const patch: Partial<typeof mapLayers.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim().slice(0, 120);
  if (typeof body.visible === "boolean") patch.visible = body.visible;
  if (typeof body.imageAlwaysVisible === "boolean") patch.imageAlwaysVisible = body.imageAlwaysVisible;
  for (const key of ["zonesAlwaysVisible", "markersAlwaysVisible", "textsAlwaysVisible", "linesAlwaysVisible"] as const) {
    if (typeof body[key] === "boolean") patch[key] = body[key];
  }
  if (typeof body.imageOpacity === "number" && Number.isFinite(body.imageOpacity)) {
    patch.imageOpacity = Math.min(1, Math.max(0, body.imageOpacity));
  }

  const [updated] = await db.update(mapLayers).set(patch).where(eq(mapLayers.id, id)).returning();
  return NextResponse.json({ layer: updated });
}

/**
 * Deletes a layer. A map always keeps at least one layer (409). A layer that
 * still holds markers, zone regions, texts, lines or a grid needs
 * `?mode=cascade`, which soft-deletes its markers/regions/zones/texts/lines
 * and removes its grid.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const layer = await findLayer(id);
  if (!layer) return NextResponse.json({ error: "Layer not found." }, { status: 404 });

  const siblings = await listLayerRows(layer.mapId);
  if (siblings.length <= 1) {
    return NextResponse.json({ error: "A map needs at least one layer." }, { status: 409 });
  }

  const [markerRows, regionRows, textRows, lineRows, grid] = await Promise.all([
    db.select({ id: markers.id }).from(markers).where(and(eq(markers.layerId, id), isNull(markers.deletedAt))),
    db.select({ id: zoneRegions.id }).from(zoneRegions).where(and(eq(zoneRegions.layerId, id), isNull(zoneRegions.deletedAt))),
    db.select({ id: mapTexts.id }).from(mapTexts).where(and(eq(mapTexts.layerId, id), isNull(mapTexts.deletedAt))),
    db.select({ id: mapLines.id }).from(mapLines).where(and(eq(mapLines.layerId, id), isNull(mapLines.deletedAt))),
    db.query.mapGrids.findFirst({ where: eq(mapGrids.layerId, id) }),
  ]);
  const hasContent = markerRows.length > 0 || regionRows.length > 0 || textRows.length > 0 || lineRows.length > 0 || Boolean(grid);
  const mode = new URL(request.url).searchParams.get("mode");
  if (hasContent && mode !== "cascade") {
    return NextResponse.json(
      { error: "This layer still has content.", markerCount: markerRows.length, regionCount: regionRows.length, textCount: textRows.length, lineCount: lineRows.length, hasGrid: Boolean(grid) },
      { status: 409 }
    );
  }

  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.update(markers).set({ deletedAt: now, updatedAt: now }).where(and(eq(markers.layerId, id), isNull(markers.deletedAt)));
    for (const r of regionRows) {
      await tx.update(zones).set({ deletedAt: now, updatedAt: now }).where(and(eq(zones.regionId, r.id), isNull(zones.deletedAt)));
    }
    await tx
      .update(zoneRegions)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(zoneRegions.layerId, id), isNull(zoneRegions.deletedAt)));
    await tx.update(mapTexts).set({ deletedAt: now, updatedAt: now }).where(and(eq(mapTexts.layerId, id), isNull(mapTexts.deletedAt)));
    await tx.update(mapLines).set({ deletedAt: now, updatedAt: now }).where(and(eq(mapLines.layerId, id), isNull(mapLines.deletedAt)));
    await tx.delete(mapGrids).where(eq(mapGrids.layerId, id));
    await tx.update(mapLayers).set({ deletedAt: now, updatedAt: now }).where(eq(mapLayers.id, id));
  });
  return NextResponse.json({ ok: true });
}
