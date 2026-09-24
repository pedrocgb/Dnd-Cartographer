import { NextResponse } from "next/server";
import { and, eq, isNull, like } from "drizzle-orm";
import { db } from "@/server/db/client";
import { articles } from "@/server/db/schema";
import { ensureDefaultWorld } from "@/server/world/default-world";
import { createEmptyDocument } from "@/server/documents/create";
import { isGenericTemplate } from "@/server/articles/templates";
import { MAX_TITLE_LENGTH, toClientArticle } from "@/server/articles/articles";

/** Generic-template articles, optionally of one template (`?template=`) and title-filtered (`?q=`). */
export async function GET(request: Request) {
  const worldId = await ensureDefaultWorld();
  const { searchParams } = new URL(request.url);
  const template = searchParams.get("template");
  const q = searchParams.get("q")?.trim();
  const conditions = [eq(articles.worldId, worldId), isNull(articles.deletedAt)];
  if (template) {
    if (!isGenericTemplate(template)) return NextResponse.json({ error: "Unknown template." }, { status: 400 });
    conditions.push(eq(articles.template, template));
  }
  if (q) conditions.push(like(articles.title, `%${q}%`));
  const rows = await db.query.articles.findMany({ where: and(...conditions) });
  return NextResponse.json({ articles: rows.map(toClientArticle) });
}

/** Creates the article together with its (empty) body and sidebar documents. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!isGenericTemplate(body?.template)) {
    return NextResponse.json({ error: "Unknown or non-generic template." }, { status: 400 });
  }
  const title = typeof body.title === "string" ? body.title.trim().slice(0, MAX_TITLE_LENGTH) : "";
  if (!title) return NextResponse.json({ error: "A title is required." }, { status: 400 });

  const worldId = await ensureDefaultWorld();
  const bodyDoc = await createEmptyDocument(worldId);
  const sidebarDoc = await createEmptyDocument(worldId);
  const [created] = await db
    .insert(articles)
    .values({ worldId, template: body.template, title, bodyDocumentId: bodyDoc.id, sidebarDocumentId: sidebarDoc.id })
    .returning();
  return NextResponse.json({ article: toClientArticle(created) }, { status: 201 });
}
