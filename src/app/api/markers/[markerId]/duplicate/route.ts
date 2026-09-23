import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { markerAffiliations, markers, politicalLinks, politicalReferences, richDocuments } from "@/server/db/schema";
import { toClientMarker } from "@/server/markers/tag-registry";
import { isLayerOfMap } from "@/server/layers/layers";

const OFFSET = 0.02;

function unit(n: unknown): number | null {
  return typeof n === "number" && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : null;
}

/**
 * Duplicate button (no body): a "(copy)" next to the source, same layer.
 * Paste (`{ exact: true, u, v, layerId }`): same name at u/v on `layerId`, and
 * also its lock, description, political affiliations, links and references.
 * Territory seats are never copied (one marker per territory).
 */
export async function POST(request: Request, { params }: { params: Promise<{ markerId: string }> }) {
  const { markerId } = await params;
  const source = await db.query.markers.findFirst({ where: eq(markers.id, markerId) });
  if (!source) {
    return NextResponse.json({ error: "Marker not found." }, { status: 404 });
  }

  const body: Record<string, unknown> = await request.json().catch(() => ({}));
  const exact = body?.exact === true;
  let layerId = source.layerId;
  let u = Math.min(1, source.u + OFFSET);
  let v = Math.min(1, source.v + OFFSET);
  if (exact) {
    if (!(await isLayerOfMap(body.layerId, source.mapId))) {
      return NextResponse.json({ error: "Layer must belong to the marker's map." }, { status: 400 });
    }
    layerId = body.layerId as string;
    u = unit(body.u) ?? source.u;
    v = unit(body.v) ?? source.v;
  }

  const duplicate = await db.transaction(async (tx) => {
    let descriptionDocumentId: string | null = null;
    if (exact && source.descriptionDocumentId) {
      const doc = await tx.query.richDocuments.findFirst({ where: eq(richDocuments.id, source.descriptionDocumentId) });
      if (doc) {
        const [copy] = await tx
          .insert(richDocuments)
          .values({ worldId: doc.worldId, jsonText: doc.jsonText, plainText: doc.plainText, schemaVersion: doc.schemaVersion })
          .returning();
        descriptionDocumentId = copy.id;
      }
    }

    const [row] = await tx
      .insert(markers)
      .values({
        mapId: source.mapId,
        layerId,
        name: exact ? source.name : `${source.name} (copy)`,
        u,
        v,
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
        ...(exact ? { locked: source.locked, descriptionDocumentId } : {}),
      })
      .returning();

    if (exact) {
      const affiliations = await tx.query.markerAffiliations.findMany({ where: eq(markerAffiliations.markerId, source.id) });
      if (affiliations.length) {
        await tx.insert(markerAffiliations).values(affiliations.map((a) => ({ markerId: row.id, territoryId: a.territoryId, status: a.status })));
      }
      const links = await tx.query.politicalLinks.findMany({
        where: and(eq(politicalLinks.ownerType, "marker"), eq(politicalLinks.ownerId, source.id)),
      });
      if (links.length) {
        await tx.insert(politicalLinks).values(
          links.map((l) => ({
            worldId: l.worldId,
            ownerType: l.ownerType,
            ownerId: row.id,
            targetType: l.targetType,
            targetId: l.targetId,
            externalUrl: l.externalUrl,
            label: l.label,
          }))
        );
      }
      const refs = await tx.query.politicalReferences.findMany({
        where: and(eq(politicalReferences.sourceType, "marker"), eq(politicalReferences.sourceId, source.id)),
      });
      if (refs.length) {
        await tx.insert(politicalReferences).values(
          refs.map((r) => ({
            worldId: r.worldId,
            sourceType: r.sourceType,
            sourceId: row.id,
            targetType: r.targetType,
            targetId: r.targetId,
            label: r.label,
          }))
        );
      }
    }
    return row;
  });

  return NextResponse.json({ marker: toClientMarker(duplicate) }, { status: 201 });
}
