import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { markers } from "@/server/db/schema";
import { isArticleTemplate } from "@/server/articles/templates";
import { documentExcerpt, resolveArticleCard } from "@/server/articles/lookup";
import { linksOfMarker } from "@/server/markers/article-links";
import { requireWorldId } from "@/server/world/active-world";
import { notInWorld } from "@/server/world/guards";

/**
 * What the map's hover card shows for a marker: its primary article (name,
 * image, excerpt) and how many other articles are linked. Without a live
 * primary article, `excerpt` falls back to the marker's own description.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ markerId: string }> }) {
  const { markerId } = await params;
  const denied = await notInWorld("markers", markerId, "Marker not found.");
  if (denied) return denied;
  const marker = await db.query.markers.findFirst({ where: eq(markers.id, markerId), columns: { descriptionDocumentId: true } });
  if (!marker) return NextResponse.json({ error: "Marker not found." }, { status: 404 });

  const [primary, ...others] = await linksOfMarker(markerId);
  const article = primary && isArticleTemplate(primary.template) ? await resolveArticleCard(await requireWorldId(), primary.template, primary.articleId) : null;
  return NextResponse.json({
    article: article && { ...article, label: primary.label },
    extraCount: others.length,
    excerpt: article ? "" : await documentExcerpt(marker.descriptionDocumentId),
  });
}
