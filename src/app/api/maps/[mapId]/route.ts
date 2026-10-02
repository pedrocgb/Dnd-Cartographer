import { NextResponse } from "next/server";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { maps, mapAssets, processingJobs, mapCategories } from "@/server/db/schema";
import { getBreadcrumbs, listMapSummaries } from "@/server/maps/tree";
import { reparentMap } from "@/server/maps/reparent";
import { InvalidReparentError } from "@/server/maps/hierarchy";
import { validFolderId } from "@/server/maps/folder-lookup";
import { notInWorld } from "@/server/world/guards";
import { foreignIdResponse, idsInWorld } from "@/server/world/guards";

export async function GET(_request: Request, { params }: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await params;
  const denied = await notInWorld("maps", mapId, "Map not found.");
  if (denied) return denied;
  const map = await db.query.maps.findFirst({ where: eq(maps.id, mapId) });
  if (!map) {
    return NextResponse.json({ error: "Map not found." }, { status: 404 });
  }

  const category = map.categoryId
    ? await db.query.mapCategories.findFirst({ where: eq(mapCategories.id, map.categoryId) })
    : null;

  // The frame asset (first processed image) once there is one; before that,
  // the most recent upload so the empty-map prompt can poll its progress.
  // Per-layer image progress is reported by /layers instead.
  const assetRows = await db.select().from(mapAssets).where(eq(mapAssets.mapId, mapId)).orderBy(mapAssets.createdAt);
  const asset = (map.currentAssetId ? assetRows.find((a) => a.id === map.currentAssetId) : undefined) ?? assetRows.at(-1) ?? null;

  let job = null;
  if (asset) {
    const jobRows = await db
      .select()
      .from(processingJobs)
      .where(eq(processingJobs.assetId, asset.id))
      .orderBy(processingJobs.createdAt);
    job = jobRows.at(-1) ?? null;
  }

  const [breadcrumbs, siblings] = await Promise.all([
    getBreadcrumbs(mapId),
    listMapSummaries(map.worldId),
  ]);
  const children = siblings.filter((m) => m.parentId === mapId);

  return NextResponse.json({ map, category, asset, job, breadcrumbs, children });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await params;
  const denied = await notInWorld("maps", mapId, "Map not found.");
  if (denied) return denied;
  const map = await db.query.maps.findFirst({ where: eq(maps.id, mapId) });
  if (!map) {
    return NextResponse.json({ error: "Map not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // Validated before anything is written, so a bad folder doesn't leave a half-applied patch.
  const folderId = "folderId" in body ? await validFolderId(map.worldId, body.folderId) : null;
  if (folderId === undefined) return NextResponse.json({ error: "Unknown folder." }, { status: 400 });

  if ("parentId" in body) {
    try {
      await reparentMap(mapId, body.parentId === null ? null : String(body.parentId));
    } catch (err) {
      if (err instanceof InvalidReparentError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }
  }

  const patch: Partial<typeof maps.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if ("categoryId" in body) patch.categoryId = body.categoryId === null ? null : String(body.categoryId);
  if ("folderId" in body) patch.folderId = folderId;
  if ("descriptionDocumentId" in body) {
    patch.descriptionDocumentId = body.descriptionDocumentId === null ? null : String(body.descriptionDocumentId);
  }

  if (!(await idsInWorld(map.worldId, [["map_categories", patch.categoryId], ["rich_documents", patch.descriptionDocumentId]]))) return foreignIdResponse();
  const [updated] = await db.update(maps).set(patch).where(eq(maps.id, mapId)).returning();
  return NextResponse.json({ map: updated });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await params;
  const denied = await notInWorld("maps", mapId, "Map not found.");
  if (denied) return denied;
  const map = await db.query.maps.findFirst({ where: eq(maps.id, mapId) });
  if (!map) {
    return NextResponse.json({ error: "Map not found." }, { status: 404 });
  }

  // Sub-maps already in the Trash stay there as they are (their own deletion date).
  const children = await db.select({ id: maps.id }).from(maps).where(and(eq(maps.parentId, mapId), isNull(maps.deletedAt)));
  const activeChildren = children.filter((c) => c.id !== mapId);

  const body = await request.json().catch(() => ({}));
  const strategy = body?.strategy as "cascade" | "orphan" | undefined;

  if (activeChildren.length > 0 && !strategy) {
    return NextResponse.json(
      {
        error: "This map has child maps.",
        childCount: activeChildren.length,
        childIds: activeChildren.map((c) => c.id),
      },
      { status: 409 }
    );
  }

  const now = new Date();

  if (activeChildren.length > 0 && strategy === "cascade") {
    // Soft-delete the whole subtree, level by level.
    let frontier = activeChildren.map((c) => c.id);
    while (frontier.length > 0) {
      await db.update(maps).set({ deletedAt: now, updatedAt: now }).where(inArray(maps.id, frontier));
      const nextRows = await db.select({ id: maps.id }).from(maps).where(and(inArray(maps.parentId, frontier), isNull(maps.deletedAt)));
      frontier = nextRows.map((r) => r.id);
    }
  } else if (activeChildren.length > 0 && strategy === "orphan") {
    await db.update(maps).set({ parentId: null, updatedAt: now }).where(and(eq(maps.parentId, mapId), isNull(maps.deletedAt)));
  }

  await db.update(maps).set({ deletedAt: now, updatedAt: now }).where(eq(maps.id, mapId));
  return NextResponse.json({ ok: true });
}
