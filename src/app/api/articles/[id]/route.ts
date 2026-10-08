import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { articles } from "@/server/db/schema";
import { encodeTags, sanitizeTags } from "@/server/articles/tags";
import { TEMPLATE_LABELS, isGenericTemplate } from "@/server/articles/templates";
import { MAX_TITLE_LENGTH, toClientArticle } from "@/server/articles/articles";
import { sanitizeInfo } from "@/server/articles/info-fields";
import { INFO_FIELD_SETS } from "@/server/articles/info-sets";
import { RelationError, type Executor } from "@/server/relations/store";
import { relationErrorResponse } from "@/server/relations/respond";
import { withRelationSync } from "@/server/relations/sync";
import { requireWorldId } from "@/server/world/active-world";
import { foreignIdResponse, idsInWorld } from "@/server/world/guards";
import { errorResponse } from "@/i18n/server";

/** A live article of the open world, or null. */
async function findArticle(id: string) {
  const worldId = await requireWorldId();
  const article = await db.query.articles.findFirst({ where: and(eq(articles.id, id), eq(articles.worldId, worldId)) });
  return article && !article.deletedAt ? article : null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const article = await findArticle((await params).id);
  if (!article) return errorResponse("articleNotFound", 404);
  return NextResponse.json({ article: toClientArticle(article) });
}

/** `title`, manual `tags` (the template tag is implicit and never stored), the optional footer, and missing document links. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const article = await findArticle(id);
  if (!article) return errorResponse("articleNotFound", 404);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return errorResponse("invalidBody", 400);

  const patch: Partial<typeof articles.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.title === "string" && body.title.trim()) patch.title = body.title.trim().slice(0, MAX_TITLE_LENGTH);
  const reserved = isGenericTemplate(article.template) ? TEMPLATE_LABELS[article.template] : undefined;
  // Only for repairing an article whose documents are missing; POST creates both.
  if (typeof body.bodyDocumentId === "string" && !article.bodyDocumentId) patch.bodyDocumentId = body.bodyDocumentId;
  if (typeof body.sidebarDocumentId === "string" && !article.sidebarDocumentId) patch.sidebarDocumentId = body.sidebarDocumentId;
  // The footer is optional: it can be added and removed at any time.
  if ("footerDocumentId" in body) {
    patch.footerDocumentId = typeof body.footerDocumentId === "string" ? body.footerDocumentId : null;
  }
  const tags = sanitizeTags(body.tags, reserved);
  if (tags) patch.tags = encodeTags(tags);
  const infoSet = isGenericTemplate(article.template) ? INFO_FIELD_SETS[article.template] : undefined;
  const info = infoSet ? sanitizeInfo(infoSet, body.info) : null;
  if (info) patch.info = JSON.stringify(info);

  if (!(await idsInWorld(article.worldId, [["rich_documents", patch.bodyDocumentId], ["rich_documents", patch.sidebarDocumentId], ["rich_documents", patch.footerDocumentId]]))) return foreignIdResponse();
  const write = async (ex: Executor) => {
    const [row] = await ex.update(articles).set(patch).where(eq(articles.id, id)).returning();
    return row;
  };
  let updated;
  try {
    updated = infoSet ? await withRelationSync(infoSet, article, body.info, write) : await write(db);
  } catch (err) {
    if (err instanceof RelationError) return relationErrorResponse(err);
    throw err;
  }
  return NextResponse.json({ article: toClientArticle(updated) });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await findArticle(id))) return errorResponse("articleNotFound", 404);
  await db.update(articles).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(articles.id, id));
  return NextResponse.json({ ok: true });
}
