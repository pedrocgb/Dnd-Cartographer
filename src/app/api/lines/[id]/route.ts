import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { mapLines, maps } from "@/server/db/schema";
import { isLayerOfMap, sanitizeExtraLayerIds } from "@/server/layers/layers";
import { parseLayerIds } from "@/server/layers/layer-ids";
import { folderError, inLockedFolder, sanitizeFolderName } from "@/server/maps/layer-folders";
import { sanitizeLinePatch, toClientLine, translatePoints } from "@/server/lines/line-config";
import { notInWorld } from "@/server/world/guards";

/**
 * Style fields, `name`, `visible`, `locked`, `sortOrder`, `groupId` (a folder on its home
 * layer, or null), `layerId` (leaves a folder of the old layer), and a move
 * as `{ dx, dy }` (frame pixels, applied server-side).
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const denied = await notInWorld("map_lines", id, "Line not found.");
  if (denied) return denied;
  const existing = await db.query.mapLines.findFirst({ where: eq(mapLines.id, id) });
  if (!existing || existing.deletedAt) return NextResponse.json({ error: "Line not found." }, { status: 404 });
  const map = await db.query.maps.findFirst({ where: eq(maps.id, existing.mapId) });
  if (!map?.frameWidth || !map.frameHeight) return NextResponse.json({ error: "Map has no frame." }, { status: 409 });
  const frame = { width: map.frameWidth, height: map.frameHeight };

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const patch: Partial<typeof mapLines.$inferInsert> = { ...sanitizeLinePatch(body, frame), updatedAt: new Date() };
  if (typeof body.visible === "boolean") patch.visible = body.visible;
  if (typeof body.locked === "boolean") patch.locked = body.locked;
  // Its place in its folder (drag and drop in the tool panel).
  if (Number.isInteger(body.sortOrder)) patch.sortOrder = body.sortOrder;
  if ("name" in body) patch.name = sanitizeFolderName(body.name);
  if ("layerId" in body) {
    if (!(await isLayerOfMap(body.layerId, existing.mapId))) {
      return NextResponse.json({ error: "Layer must belong to the line's map." }, { status: 400 });
    }
    patch.layerId = body.layerId;
  }
  const homeLayerId = patch.layerId ?? existing.layerId;
  if ("groupId" in body && body.groupId !== existing.groupId) {
    // Leaving a locked folder is refused like entering one.
    if (await inLockedFolder("line", existing.groupId)) return NextResponse.json({ error: "The folder is locked." }, { status: 409 });
    const groupError = await folderError("line", body.groupId, existing.mapId, homeLayerId);
    if (groupError) return NextResponse.json({ error: groupError }, { status: 409 });
    patch.groupId = body.groupId;
  } else if (patch.layerId !== undefined && patch.layerId !== existing.layerId) {
    // A folder belongs to one layer: moving the line elsewhere ungroups it.
    patch.groupId = null;
  }

  // "Also show on" layers; re-checked when the home layer changes so it never lists the home itself.
  if ("extraLayerIds" in body || patch.layerId !== undefined) {
    const raw = "extraLayerIds" in body ? body.extraLayerIds : parseLayerIds(existing.extraLayerIds);
    const encoded = await sanitizeExtraLayerIds(raw, existing.mapId, patch.layerId ?? existing.layerId);
    if (encoded !== null) patch.extraLayerIds = encoded;
  }
  const dx = typeof body.dx === "number" && Number.isFinite(body.dx) ? body.dx : 0;
  const dy = typeof body.dy === "number" && Number.isFinite(body.dy) ? body.dy : 0;
  if (dx || dy) {
    const current = toClientLine(existing).points;
    if (current.length >= 2) patch.points = JSON.stringify(translatePoints(current, dx, dy, frame));
  }

  const [updated] = await db.update(mapLines).set(patch).where(eq(mapLines.id, id)).returning();
  return NextResponse.json({ line: toClientLine(updated) });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const denied = await notInWorld("map_lines", id, "Line not found.");
  if (denied) return denied;
  await db.update(mapLines).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(mapLines.id, id));
  return NextResponse.json({ ok: true });
}
