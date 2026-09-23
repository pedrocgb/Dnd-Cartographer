import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { mapLines, maps } from "@/server/db/schema";
import { isLayerOfMap, sanitizeExtraLayerIds } from "@/server/layers/layers";
import { parseLayerIds } from "@/server/layers/layer-ids";
import { sanitizeLinePatch, toClientLine, translatePoints } from "@/server/lines/line-config";

/** Style fields, `layerId`, and a move as `{ dx, dy }` (frame pixels, applied server-side). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await db.query.mapLines.findFirst({ where: eq(mapLines.id, id) });
  if (!existing || existing.deletedAt) return NextResponse.json({ error: "Line not found." }, { status: 404 });
  const map = await db.query.maps.findFirst({ where: eq(maps.id, existing.mapId) });
  if (!map?.frameWidth || !map.frameHeight) return NextResponse.json({ error: "Map has no frame." }, { status: 409 });
  const frame = { width: map.frameWidth, height: map.frameHeight };

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const patch: Partial<typeof mapLines.$inferInsert> = { ...sanitizeLinePatch(body, frame), updatedAt: new Date() };
  if ("layerId" in body) {
    if (!(await isLayerOfMap(body.layerId, existing.mapId))) {
      return NextResponse.json({ error: "Layer must belong to the line's map." }, { status: 400 });
    }
    patch.layerId = body.layerId;
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
  await db.update(mapLines).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(mapLines.id, id));
  return NextResponse.json({ ok: true });
}
