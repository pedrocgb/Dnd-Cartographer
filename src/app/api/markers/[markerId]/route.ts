import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { markers, maps } from "@/server/db/schema";
import {
  isValidIconKey,
  normalizeColor,
  isValidBackgroundShape,
  isValidMarkerCategory,
  DEFAULT_COLOR,
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_OUTLINE_COLOR,
} from "@/server/markers/icon-registry";
import { isValidEnvironmentTag, isValidOwnershipTag, encodeStatusTags, toClientMarker } from "@/server/markers/tag-registry";
import { isLayerOfMap, sanitizeExtraLayerIds } from "@/server/layers/layers";
import { parseLayerIds } from "@/server/layers/layer-ids";

export async function PATCH(request: Request, { params }: { params: Promise<{ markerId: string }> }) {
  const { markerId } = await params;
  const marker = await db.query.markers.findFirst({ where: eq(markers.id, markerId) });
  if (!marker) {
    return NextResponse.json({ error: "Marker not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const patch: Partial<typeof markers.$inferInsert> = { updatedAt: new Date(), revision: marker.revision + 1 };

  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (typeof body.iconKey === "string" && isValidIconKey(body.iconKey)) patch.iconKey = body.iconKey;
  if (typeof body.color === "string") patch.color = normalizeColor(body.color, DEFAULT_COLOR);
  if (typeof body.backgroundColor === "string")
    patch.backgroundColor = normalizeColor(body.backgroundColor, DEFAULT_BACKGROUND_COLOR);
  if (typeof body.outlineColor === "string")
    patch.outlineColor = normalizeColor(body.outlineColor, DEFAULT_OUTLINE_COLOR);
  if (typeof body.backgroundShape === "string" && isValidBackgroundShape(body.backgroundShape))
    patch.backgroundShape = body.backgroundShape;
  if (typeof body.category === "string" && isValidMarkerCategory(body.category)) patch.category = body.category;
  if (typeof body.locked === "boolean") patch.locked = body.locked;
  if ("descriptionDocumentId" in body) {
    patch.descriptionDocumentId = body.descriptionDocumentId === null ? null : String(body.descriptionDocumentId);
  }
  if (Array.isArray(body.statusTags)) patch.statusTags = encodeStatusTags(body.statusTags);
  if ("environment" in body) {
    patch.environment =
      body.environment === null ? null : typeof body.environment === "string" && isValidEnvironmentTag(body.environment) ? body.environment : marker.environment;
  }
  if ("ownership" in body) {
    patch.ownership =
      body.ownership === null ? null : typeof body.ownership === "string" && isValidOwnershipTag(body.ownership) ? body.ownership : marker.ownership;
  }

  if ("u" in body || "v" in body) {
    if (marker.locked && !("locked" in body)) {
      return NextResponse.json({ error: "Marker is locked." }, { status: 409 });
    }
    const u = Number(body.u);
    const v = Number(body.v);
    if (!Number.isFinite(u) || !Number.isFinite(v) || u < 0 || u > 1 || v < 0 || v > 1) {
      return NextResponse.json({ error: "Marker position must be normalized u/v in [0, 1]." }, { status: 400 });
    }
    patch.u = u;
    patch.v = v;
  }

  if ("layerId" in body) {
    if (!(await isLayerOfMap(body.layerId, marker.mapId))) {
      return NextResponse.json({ error: "Layer must belong to the marker's map." }, { status: 400 });
    }
    patch.layerId = body.layerId;
  }

  // "Also show on" layers; re-checked when the home layer changes so it never lists the home itself.
  if ("extraLayerIds" in body || patch.layerId !== undefined) {
    const raw = "extraLayerIds" in body ? body.extraLayerIds : parseLayerIds(marker.extraLayerIds);
    const encoded = await sanitizeExtraLayerIds(raw, marker.mapId, patch.layerId ?? marker.layerId);
    if (encoded !== null) patch.extraLayerIds = encoded;
  }

  if ("linkedMapId" in body) {
    if (body.linkedMapId === null) {
      patch.linkedMapId = null;
    } else {
      const linkedMap = await db.query.maps.findFirst({ where: eq(maps.id, String(body.linkedMapId)) });
      const ownerMap = await db.query.maps.findFirst({ where: eq(maps.id, marker.mapId) });
      if (!linkedMap || !ownerMap || linkedMap.worldId !== ownerMap.worldId) {
        return NextResponse.json({ error: "Linked map must exist in the same world." }, { status: 400 });
      }
      patch.linkedMapId = linkedMap.id;
    }
  }

  const [updated] = await db.update(markers).set(patch).where(eq(markers.id, markerId)).returning();
  return NextResponse.json({ marker: toClientMarker(updated) });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ markerId: string }> }) {
  const { markerId } = await params;
  const marker = await db.query.markers.findFirst({ where: eq(markers.id, markerId) });
  if (!marker) {
    return NextResponse.json({ error: "Marker not found." }, { status: 404 });
  }

  await db.update(markers).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(markers.id, markerId));
  return NextResponse.json({ ok: true });
}
