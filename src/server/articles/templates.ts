/**
 * Article templates, in sidebar / "Create new article" order. Pure data (no
 * icons) so both the API and the client can import it; the client adds
 * icons in src/components/articles/templates.ts.
 *
 * Territory, character and organization are stored in their own politics
 * tables (territories, people, organizations); every other template is a
 * row of the generic `articles` table.
 */
export const ARTICLE_TEMPLATE_KEYS = [
  "character",
  "organization",
  "territory",
  "settlement",
  "building",
  "geography",
  "military",
  "conflict",
  "technology",
  "title",
  "law",
  "culture",
  "tradition",
  "species",
  "religion",
  "item",
  "magic",
  "generic",
  "document",
  "language",
] as const;

export type ArticleTemplateKey = (typeof ARTICLE_TEMPLATE_KEYS)[number];

/** The sidebar's groups (shown with a gap between them); together, ARTICLE_TEMPLATE_KEYS in order. */
export const ARTICLE_TEMPLATE_GROUPS: readonly (readonly ArticleTemplateKey[])[] = [
  ["character", "organization"],
  ["territory", "settlement", "building", "geography"],
  ["military", "conflict", "technology"],
  ["title", "law"],
  ["culture", "tradition", "species", "religion"],
  ["item", "magic"],
  ["generic", "document", "language"],
];

/** Singular name; also the article's fixed template tag. */
export const TEMPLATE_LABELS: Record<ArticleTemplateKey, string> = {
  character: "Character",
  organization: "Organization",
  territory: "Territory",
  settlement: "Settlement",
  building: "Building",
  geography: "Geography",
  military: "Military",
  conflict: "Conflict",
  technology: "Technology",
  title: "Title",
  law: "Law",
  tradition: "Tradition",
  culture: "Culture",
  species: "Species",
  religion: "Religion",
  item: "Item",
  magic: "Magic & Spells",
  generic: "Generic",
  document: "Document",
  language: "Language",
};

/** Templates backed by a politics table instead of `articles`. */
export const RECORD_TEMPLATES = ["character", "organization", "territory"] as const;
export type RecordTemplateKey = (typeof RECORD_TEMPLATES)[number];
export type GenericTemplateKey = Exclude<ArticleTemplateKey, RecordTemplateKey>;

export function isArticleTemplate(value: unknown): value is ArticleTemplateKey {
  return typeof value === "string" && (ARTICLE_TEMPLATE_KEYS as readonly string[]).includes(value);
}

export function isRecordTemplate(value: unknown): value is RecordTemplateKey {
  return typeof value === "string" && (RECORD_TEMPLATES as readonly string[]).includes(value);
}

export function isGenericTemplate(value: unknown): value is GenericTemplateKey {
  return isArticleTemplate(value) && !isRecordTemplate(value);
}

/**
 * URL of an article page. Accepts the politics record kinds too
 * ("person" is a character article).
 */
export function articleHref(type: ArticleTemplateKey | "person", id?: string): string {
  const template = type === "person" ? "character" : type;
  return id ? `/articles?type=${template}&id=${encodeURIComponent(id)}` : `/articles?type=${template}`;
}
