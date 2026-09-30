import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { maps, markerArticleLinks, markers } from "@/server/db/schema";
import { orderLinks, promotedAfterRemoval } from "./link-order";

type LinkRow = typeof markerArticleLinks.$inferSelect;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Makes `linkId` the marker's only primary link. Clears first so the partial unique index never trips. */
export async function setPrimaryLink(tx: Tx, markerId: string, linkId: string): Promise<void> {
  await tx
    .update(markerArticleLinks)
    .set({ isPrimary: false, updatedAt: new Date() })
    .where(and(eq(markerArticleLinks.markerId, markerId), eq(markerArticleLinks.isPrimary, true)));
  await tx
    .update(markerArticleLinks)
    .set({ isPrimary: true, updatedAt: new Date() })
    .where(and(eq(markerArticleLinks.id, linkId), eq(markerArticleLinks.markerId, markerId)));
}

/** Removes one link; if it was the primary, the oldest remaining link takes over. */
export async function removeLink(markerId: string, linkId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(markerArticleLinks).where(and(eq(markerArticleLinks.id, linkId), eq(markerArticleLinks.markerId, markerId)));
    const remaining = await tx.query.markerArticleLinks.findMany({ where: eq(markerArticleLinks.markerId, markerId) });
    const next = promotedAfterRemoval(remaining);
    if (next) await setPrimaryLink(tx, markerId, next.id);
  });
}

export async function linksOfMarker(markerId: string): Promise<LinkRow[]> {
  const rows = await db.query.markerArticleLinks.findMany({
    where: eq(markerArticleLinks.markerId, markerId),
    orderBy: asc(markerArticleLinks.createdAt),
  });
  return orderLinks(rows);
}

export interface ArticleMarker {
  linkId: string;
  label: string;
  isPrimary: boolean;
  markerId: string;
  markerName: string;
  mapId: string;
  mapName: string;
  iconKey: string;
  color: string;
  backgroundColor: string;
  outlineColor: string;
  backgroundShape: string;
}

/** Every live marker linked to this article, with its map — for the article page's "On the map" section. */
export async function markersOfArticle(articleId: string): Promise<ArticleMarker[]> {
  const links = await db.query.markerArticleLinks.findMany({ where: eq(markerArticleLinks.articleId, articleId) });
  if (!links.length) return [];
  const rows = await db
    .select({
      id: markers.id,
      name: markers.name,
      mapId: markers.mapId,
      mapName: maps.name,
      iconKey: markers.iconKey,
      color: markers.color,
      backgroundColor: markers.backgroundColor,
      outlineColor: markers.outlineColor,
      backgroundShape: markers.backgroundShape,
    })
    .from(markers)
    .innerJoin(maps, eq(maps.id, markers.mapId))
    .where(and(inArray(markers.id, links.map((l) => l.markerId)), isNull(markers.deletedAt), isNull(maps.deletedAt)));
  const byId = new Map(rows.map((r) => [r.id, r]));
  return orderLinks(links).flatMap((l) => {
    const m = byId.get(l.markerId);
    if (!m) return [];
    return [
      {
        linkId: l.id,
        label: l.label,
        isPrimary: l.isPrimary,
        markerId: m.id,
        markerName: m.name,
        mapId: m.mapId,
        mapName: m.mapName,
        iconKey: m.iconKey,
        color: m.color,
        backgroundColor: m.backgroundColor,
        outlineColor: m.outlineColor,
        backgroundShape: m.backgroundShape,
      },
    ];
  });
}
