import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { mapTexts, maps } from "@/server/db/schema";
import { isLayerOfMap, sanitizeExtraLayerIds } from "@/server/layers/layers";
import { parseLayerIds, withLayerIds } from "@/server/layers/layer-ids";
import { sanitizeTextPatch } from "@/server/texts/text-config";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await db.query.mapTexts.findFirst({ where: eq(mapTexts.id, id) });
  if (!existing || existing.deletedAt) return NextResponse.json({ error: "Text not found." }, { status: 404 });
  const map = await db.query.maps.findFirst({ where: eq(maps.id, existing.mapId) });
  if (!map?.frameWidth || !map.frameHeight) return NextResponse.json({ error: "Map has no frame." }, { status: 409 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const patch: Partial<typeof mapTexts.$inferInsert> = {
    ...sanitizeTextPatch(body, { width: map.frameWidth, height: map.frameHeight }),
    updatedAt: new Date(),
  };
  if (typeof body.visible === "boolean") patch.visible = body.visible;
  if (patch.text !== undefined && !patch.text.trim()) {
    return NextResponse.json({ error: "Text can't be empty." }, { status: 400 });
  }
  if ("layerId" in body) {
    if (!(await isLayerOfMap(body.layerId, existing.mapId))) {
      return NextResponse.json({ error: "Layer must belong to the text's map." }, { status: 400 });
    }
    patch.layerId = body.layerId;
  }

  // "Also show on" layers; re-checked when the home layer changes so it never lists the home itself.
  if ("extraLayerIds" in body || patch.layerId !== undefined) {
    const raw = "extraLayerIds" in body ? body.extraLayerIds : parseLayerIds(existing.extraLayerIds);
    const encoded = await sanitizeExtraLayerIds(raw, existing.mapId, patch.layerId ?? existing.layerId);
    if (encoded !== null) patch.extraLayerIds = encoded;
  }

  const [updated] = await db.update(mapTexts).set(patch).where(eq(mapTexts.id, id)).returning();
  return NextResponse.json({ text: withLayerIds(updated) });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.update(mapTexts).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(mapTexts.id, id));
  return NextResponse.json({ ok: true });
}
