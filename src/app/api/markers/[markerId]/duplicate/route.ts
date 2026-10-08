import { NextResponse } from "next/server";
import { errorResponse, serverT } from "@/i18n/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { markerAffiliations, markerArticleLinks, markers, politicalLinks, richDocuments } from "@/server/db/schema";
import { toClientMarker } from "@/server/markers/tag-registry";
import { isLayerOfMap } from "@/server/layers/layers";
import { notInWorld } from "@/server/world/guards";

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
  const denied = await notInWorld("markers", markerId, "markerNotFound");
  if (denied) return denied;
  const source = await db.query.markers.findFirst({ where: eq(markers.id, markerId) });
  if (!source) {
    return errorResponse("markerNotFound", 404);
  }

  const body: Record<string, unknown> = await request.json().catch(() => ({}));
  const exact = body?.exact === true;
  let layerId = source.layerId;
  let u = Math.min(1, source.u + OFFSET);
  let v = Math.min(1, source.v + OFFSET);
  if (exact) {
    if (!(await isLayerOfMap(body.layerId, source.mapId))) {
      return errorResponse("layerOfMarkerMap", 400);
    }
    layerId = body.layerId as string;
    u = unit(body.u) ?? source.u;
    v = unit(body.v) ?? source.v;
  }

  // Worded before the transaction: the copy's name follows the user's language.
  const copyName = exact ? source.name : (await serverT("maps"))("defaults.copyOf", { name: source.name });
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
        name: copyName,
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
        labelMode: source.labelMode,
        importance: source.importance,
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
      const articleLinks = await tx.query.markerArticleLinks.findMany({ where: eq(markerArticleLinks.markerId, source.id) });
      if (articleLinks.length) {
        await tx.insert(markerArticleLinks).values(
          articleLinks.map((l) => ({
            worldId: l.worldId,
            markerId: row.id,
            template: l.template,
            articleId: l.articleId,
            label: l.label,
            isPrimary: l.isPrimary,
          }))
        );
      }
    }
    return row;
  });

  return NextResponse.json({ marker: toClientMarker(duplicate) }, { status: 201 });
}
