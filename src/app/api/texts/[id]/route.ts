import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { mapTexts, maps } from "@/server/db/schema";
import { isLayerOfMap, sanitizeExtraLayerIds } from "@/server/layers/layers";
import { parseLayerIds, withLayerIds } from "@/server/layers/layer-ids";
import { folderError, inLockedFolder } from "@/server/maps/layer-folders";
import { sanitizeTextPatch } from "@/server/texts/text-config";

/**
 * Content, style and position fields, `visible`, `locked`, `sortOrder`, `groupId` (a
 * folder on its home layer, or null) and `layerId` (leaves a folder of the
 * old layer).
 */
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
  if (typeof body.locked === "boolean") patch.locked = body.locked;
  // Its place in its folder (drag and drop in the tool panel).
  if (Number.isInteger(body.sortOrder)) patch.sortOrder = body.sortOrder;
  if (patch.text !== undefined && !patch.text.trim()) {
    return NextResponse.json({ error: "Text can't be empty." }, { status: 400 });
  }
  if ("layerId" in body) {
    if (!(await isLayerOfMap(body.layerId, existing.mapId))) {
      return NextResponse.json({ error: "Layer must belong to the text's map." }, { status: 400 });
    }
    patch.layerId = body.layerId;
  }
  const homeLayerId = patch.layerId ?? existing.layerId;
  if ("groupId" in body && body.groupId !== existing.groupId) {
    // Leaving a locked folder is refused like entering one.
    if (await inLockedFolder("text", existing.groupId)) return NextResponse.json({ error: "The folder is locked." }, { status: 409 });
    const groupError = await folderError("text", body.groupId, existing.mapId, homeLayerId);
    if (groupError) return NextResponse.json({ error: groupError }, { status: 409 });
    patch.groupId = body.groupId;
  } else if (patch.layerId !== undefined && patch.layerId !== existing.layerId) {
    // A folder belongs to one layer: moving the text elsewhere ungroups it.
    patch.groupId = null;
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
