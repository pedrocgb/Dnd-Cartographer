import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/server/db/client";
import { maps, mapAssets, processingJobs, mapCategories } from "@/server/db/schema";
import { getBreadcrumbs, listMapSummaries } from "@/server/maps/tree";
import { reparentMap } from "@/server/maps/reparent";
import { InvalidReparentError } from "@/server/maps/hierarchy";

export async function GET(_request: Request, { params }: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await params;
  const map = await db.query.maps.findFirst({ where: eq(maps.id, mapId) });
  if (!map) {
    return NextResponse.json({ error: "Map not found." }, { status: 404 });
  }

  const category = map.categoryId
    ? await db.query.mapCategories.findFirst({ where: eq(mapCategories.id, map.categoryId) })
    : null;

  // Report the most recently uploaded asset (not just the last *ready* one)
  // so a client polling mid-processing/mid-replacement sees live progress.
  const assetRows = await db.select().from(mapAssets).where(eq(mapAssets.mapId, mapId)).orderBy(mapAssets.createdAt);
  const asset = assetRows.at(-1) ?? null;

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
  const map = await db.query.maps.findFirst({ where: eq(maps.id, mapId) });
  if (!map) {
    return NextResponse.json({ error: "Map not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

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
  if ("descriptionDocumentId" in body) {
    patch.descriptionDocumentId = body.descriptionDocumentId === null ? null : String(body.descriptionDocumentId);
  }

  const [updated] = await db.update(maps).set(patch).where(eq(maps.id, mapId)).returning();
  return NextResponse.json({ map: updated });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await params;
  const map = await db.query.maps.findFirst({ where: eq(maps.id, mapId) });
  if (!map) {
    return NextResponse.json({ error: "Map not found." }, { status: 404 });
  }

  const children = await db.select({ id: maps.id }).from(maps).where(eq(maps.parentId, mapId));
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
      const nextRows = await db.select({ id: maps.id }).from(maps).where(inArray(maps.parentId, frontier));
      frontier = nextRows.map((r) => r.id);
    }
  } else if (activeChildren.length > 0 && strategy === "orphan") {
    await db.update(maps).set({ parentId: null, updatedAt: now }).where(eq(maps.parentId, mapId));
  }

  await db.update(maps).set({ deletedAt: now, updatedAt: now }).where(eq(maps.id, mapId));
  return NextResponse.json({ ok: true });
}
