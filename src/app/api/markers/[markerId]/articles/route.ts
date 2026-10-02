import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { markerArticleLinks, markers } from "@/server/db/schema";
import { requireWorldId } from "@/server/world/active-world";
import { resolveArticleNames, verifiedArticleName } from "@/server/articles/lookup";
import { isArticleTemplate } from "@/server/articles/templates";
import { linksOfMarker, setPrimaryLink } from "@/server/markers/article-links";
import { notInWorld } from "@/server/world/guards";

const MAX_LABEL_LENGTH = 80;

/** The marker's linked articles, primary first then oldest; `name` is null once the article is deleted. */
export async function GET(_request: Request, { params }: { params: Promise<{ markerId: string }> }) {
  const { markerId } = await params;
  const denied = await notInWorld("markers", markerId, "Marker not found.");
  if (denied) return denied;
  const rows = await linksOfMarker(markerId);
  const names = await resolveArticleNames(await requireWorldId(), rows);
  return NextResponse.json({ links: rows.map((r) => ({ ...r, name: names.get(r.articleId) ?? null })) });
}

/** Links an article. The marker's first link, or one sent with `primary: true`, becomes its primary article. */
export async function POST(request: Request, { params }: { params: Promise<{ markerId: string }> }) {
  const { markerId } = await params;
  const denied = await notInWorld("markers", markerId, "Marker not found.");
  if (denied) return denied;
  const marker = await db.query.markers.findFirst({ where: eq(markers.id, markerId) });
  if (!marker) return NextResponse.json({ error: "Marker not found." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const template = body?.template;
  const articleId = typeof body?.articleId === "string" ? body.articleId : "";
  if (!isArticleTemplate(template)) return NextResponse.json({ error: "Unknown article template." }, { status: 400 });
  if (!articleId) return NextResponse.json({ error: "articleId is required." }, { status: 400 });

  const worldId = await requireWorldId();
  const name = await verifiedArticleName(worldId, template, articleId);
  if (!name) return NextResponse.json({ error: "Article not found." }, { status: 404 });

  const existing = await db.query.markerArticleLinks.findFirst({
    where: and(eq(markerArticleLinks.markerId, markerId), eq(markerArticleLinks.articleId, articleId)),
  });
  if (existing) return NextResponse.json({ error: `"${name}" is already linked to this marker.` }, { status: 409 });

  const label = typeof body?.label === "string" ? body.label.trim().slice(0, MAX_LABEL_LENGTH) : "";
  const created = await db.transaction(async (tx) => {
    const hasPrimary = await tx.query.markerArticleLinks.findFirst({
      where: and(eq(markerArticleLinks.markerId, markerId), eq(markerArticleLinks.isPrimary, true)),
    });
    const [row] = await tx.insert(markerArticleLinks).values({ worldId, markerId, template, articleId, label }).returning();
    if (!hasPrimary || body?.primary === true) {
      await setPrimaryLink(tx, markerId, row.id);
      return { ...row, isPrimary: true };
    }
    return row;
  });
  return NextResponse.json({ link: { ...created, name } }, { status: 201 });
}
