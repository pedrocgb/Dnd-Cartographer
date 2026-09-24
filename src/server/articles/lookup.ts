import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { articles, organizations, people, territories } from "@/server/db/schema";
import { isArticleTemplate, type ArticleTemplateKey } from "./templates";

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
    if (template === "character" || template === "organization" || template === "territory") byTable[template].push(articleId);
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

/** Whether a generic article's stored template matches (a settlement id can't be linked as a law). */
export async function genericTemplateOf(id: string): Promise<string | null> {
  const row = await db.query.articles.findFirst({ where: eq(articles.id, id), columns: { template: true } });
  return row?.template ?? null;
}
