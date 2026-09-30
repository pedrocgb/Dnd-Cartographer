import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { articles, organizations, people, richDocuments, territories } from "@/server/db/schema";
import { isArticleTemplate, isRecordTemplate, type ArticleTemplateKey } from "./templates";
import { excerptOf } from "@/server/documents/excerpt";

/** A live (not deleted) article of any template: its display name, or null. */
export async function findArticleName(template: ArticleTemplateKey, id: string): Promise<string | null> {
  const names = await resolveArticleNames([{ template, articleId: id }]);
  return names.get(id) ?? null;
}

/**
 * Display names of live articles, keyed by id — a deleted or missing
 * article is simply absent. Batched: one query per template table.
 */
export async function resolveArticleNames(refs: { template: string; articleId: string }[]): Promise<Map<string, string>> {
  const byTable = { character: [] as string[], organization: [] as string[], territory: [] as string[], generic: [] as string[] };
  for (const { template, articleId } of refs) {
    if (!isArticleTemplate(template)) continue;
    if (template === "character" || template === "playerCharacter") byTable.character.push(articleId);
    else if (template === "organization" || template === "territory") byTable[template].push(articleId);
    else byTable.generic.push(articleId);
  }

  const names = new Map<string, string>();
  const [personRows, orgRows, territoryRows, articleRows] = await Promise.all([
    byTable.character.length
      ? db.select({ id: people.id, name: people.name }).from(people).where(and(inArray(people.id, byTable.character), isNull(people.deletedAt)))
      : [],
    byTable.organization.length
      ? db
          .select({ id: organizations.id, name: organizations.name })
          .from(organizations)
          .where(and(inArray(organizations.id, byTable.organization), isNull(organizations.deletedAt)))
      : [],
    byTable.territory.length
      ? db
          .select({ id: territories.id, name: territories.name })
          .from(territories)
          .where(and(inArray(territories.id, byTable.territory), isNull(territories.deletedAt)))
      : [],
    byTable.generic.length
      ? db.select({ id: articles.id, name: articles.title }).from(articles).where(and(inArray(articles.id, byTable.generic), isNull(articles.deletedAt)))
      : [],
  ]);
  for (const row of [...personRows, ...orgRows, ...territoryRows, ...articleRows]) names.set(row.id, row.name);
  return names;
}

/**
 * The name of the live article `id` of `template`, or null when it doesn't
 * exist, was deleted, or is a generic article of another template.
 */
export async function verifiedArticleName(template: ArticleTemplateKey, id: string): Promise<string | null> {
  if (!isRecordTemplate(template) && (await genericTemplateOf(id)) !== template) return null;
  return findArticleName(template, id);
}

/** Whether a generic article's stored template matches (a settlement id can't be linked as a law). */
export async function genericTemplateOf(id: string): Promise<string | null> {
  const row = await db.query.articles.findFirst({ where: eq(articles.id, id), columns: { template: true } });
  return row?.template ?? null;
}

/** Plain-text excerpt of a rich document, "" when it is missing or empty. */
export async function documentExcerpt(documentId: string | null): Promise<string> {
  if (!documentId) return "";
  const row = await db.query.richDocuments.findFirst({ where: eq(richDocuments.id, documentId), columns: { plainText: true } });
  return excerptOf(row?.plainText ?? "");
}

export interface ArticleCard {
  template: ArticleTemplateKey;
  id: string;
  name: string;
  /** Served by /api/politics/portraits, versioned so a re-upload busts the cache; null without an image. */
  portraitUrl: string | null;
  excerpt: string;
}

/** What a hover card shows for an article: name, image and the start of its main text. Null once deleted. */
export async function resolveArticleCard(template: ArticleTemplateKey, id: string): Promise<ArticleCard | null> {
  const columns = { name: true, portraitKey: true, updatedAt: true, descriptionDocumentId: true, deletedAt: true } as const;
  let row: { name: string; portraitKey: string | null; updatedAt: Date; documentId: string | null; deletedAt: Date | null } | undefined;
  if (template === "character" || template === "playerCharacter") {
    const r = await db.query.people.findFirst({ where: eq(people.id, id), columns });
    row = r && { ...r, documentId: r.descriptionDocumentId };
  } else if (template === "organization") {
    const r = await db.query.organizations.findFirst({ where: eq(organizations.id, id), columns });
    row = r && { ...r, documentId: r.descriptionDocumentId };
  } else if (template === "territory") {
    const r = await db.query.territories.findFirst({ where: eq(territories.id, id), columns });
    row = r && { ...r, documentId: r.descriptionDocumentId };
  } else {
    const r = await db.query.articles.findFirst({
      where: eq(articles.id, id),
      columns: { title: true, portraitKey: true, updatedAt: true, bodyDocumentId: true, deletedAt: true },
    });
    row = r && { name: r.title, portraitKey: r.portraitKey, updatedAt: r.updatedAt, documentId: r.bodyDocumentId, deletedAt: r.deletedAt };
  }
  if (!row || row.deletedAt) return null;
  return {
    template,
    id,
    name: row.name,
    portraitUrl: row.portraitKey ? `/api/politics/portraits/${row.portraitKey}?v=${row.updatedAt.getTime()}` : null,
    excerpt: await documentExcerpt(row.documentId),
  };
}
