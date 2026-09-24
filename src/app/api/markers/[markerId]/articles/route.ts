import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { markerArticleLinks, markers } from "@/server/db/schema";
import { ensureDefaultWorld } from "@/server/world/default-world";
import { findArticleName, genericTemplateOf, resolveArticleNames } from "@/server/articles/lookup";
import { isArticleTemplate, isRecordTemplate } from "@/server/articles/templates";

const MAX_LABEL_LENGTH = 80;

/** The marker's linked articles, oldest first; `name` is null once the article is deleted. */
export async function GET(_request: Request, { params }: { params: Promise<{ markerId: string }> }) {
  const { markerId } = await params;
  const rows = await db.query.markerArticleLinks.findMany({
    where: eq(markerArticleLinks.markerId, markerId),
    orderBy: asc(markerArticleLinks.createdAt),
  });
  const names = await resolveArticleNames(rows);
  return NextResponse.json({ links: rows.map((r) => ({ ...r, name: names.get(r.articleId) ?? null })) });
}

export async function POST(request: Request, { params }: { params: Promise<{ markerId: string }> }) {
  const { markerId } = await params;
  const marker = await db.query.markers.findFirst({ where: eq(markers.id, markerId) });
  if (!marker) return NextResponse.json({ error: "Marker not found." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const template = body?.template;
  const articleId = typeof body?.articleId === "string" ? body.articleId : "";
  if (!isArticleTemplate(template)) return NextResponse.json({ error: "Unknown article template." }, { status: 400 });
  if (!articleId) return NextResponse.json({ error: "articleId is required." }, { status: 400 });

  // A generic article's id must belong to that template (the name lookup alone can't tell a law from a settlement).
  if (!isRecordTemplate(template) && (await genericTemplateOf(articleId)) !== template) {
    return NextResponse.json({ error: "Article not found." }, { status: 404 });
  }
  const name = await findArticleName(template, articleId);
  if (!name) return NextResponse.json({ error: "Article not found." }, { status: 404 });

  const existing = await db.query.markerArticleLinks.findFirst({
    where: and(eq(markerArticleLinks.markerId, markerId), eq(markerArticleLinks.articleId, articleId)),
  });
  if (existing) return NextResponse.json({ error: `"${name}" is already linked to this marker.` }, { status: 409 });

  const worldId = await ensureDefaultWorld();
  const label = typeof body?.label === "string" ? body.label.trim().slice(0, MAX_LABEL_LENGTH) : "";
  const [created] = await db.insert(markerArticleLinks).values({ worldId, markerId, template, articleId, label }).returning();
  return NextResponse.json({ link: { ...created, name } }, { status: 201 });
}
