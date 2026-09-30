import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { mapLegends } from "@/server/db/schema";
import { findLayer, sanitizeExtraLayerIds } from "@/server/layers/layers";
import { applyLegendPatch, DEFAULT_LEGEND, parseLegendConfig } from "@/server/legends/legend-config";
import { toClientLegend } from "@/server/legends/legends";

const findLegend = (layerId: string) => db.query.mapLegends.findFirst({ where: eq(mapLegends.layerId, layerId) });

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const legend = await findLegend(id);
  return NextResponse.json({ legend: legend ? toClientLegend(legend) : null });
}

/** Creates the layer's legend (each layer has at most one); an existing one is returned as is. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const layer = await findLayer(id);
  if (!layer) return NextResponse.json({ error: "Layer not found." }, { status: 404 });
  const existing = await findLegend(id);
  if (existing) return NextResponse.json({ legend: toClientLegend(existing) });
  await db
    .insert(mapLegends)
    .values({ mapId: layer.mapId, layerId: id, config: JSON.stringify(DEFAULT_LEGEND) })
    .onConflictDoNothing();
  const created = await findLegend(id);
  return NextResponse.json({ legend: created ? toClientLegend(created) : null }, { status: 201 });
}

/** Body: any of `visible`, `extraLayerIds`, `config` (a partial config, merged and validated). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const legend = await findLegend(id);
  if (!legend) return NextResponse.json({ error: "Legend not found." }, { status: 404 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const patch: Partial<typeof mapLegends.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.visible === "boolean") patch.visible = body.visible;
  if ("extraLayerIds" in body) {
    const encoded = await sanitizeExtraLayerIds(body.extraLayerIds, legend.mapId, legend.layerId);
    if (encoded !== null) patch.extraLayerIds = encoded;
  }
  if ("config" in body) patch.config = JSON.stringify(applyLegendPatch(parseLegendConfig(legend.config), body.config));

  const [updated] = await db.update(mapLegends).set(patch).where(eq(mapLegends.layerId, id)).returning();
  return NextResponse.json({ legend: toClientLegend(updated) });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.delete(mapLegends).where(eq(mapLegends.layerId, id));
  return NextResponse.json({ ok: true });
}
