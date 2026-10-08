import { and, asc, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { db } from "../db/client";
import { articles, authorityAssignments, markerArticleLinks, organizations, people, relations, territories, territorySeats } from "../db/schema";
import { isArticleTemplate, personTemplate, type ArticleTemplateKey } from "../articles/templates";
import type { RecordKind } from "./types";
import { validateRelation, type ExistingRelation } from "./validate";
import { createTranslator, translate } from "../../i18n/translate";
import type { Locale } from "../../i18n/config";
import { authorityRoleLabel } from "../politics/hierarchy-config";
import type { MessageKey } from "../../i18n/messages";

/** The database or an open transaction. */
export type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export type RelationRow = typeof relations.$inferSelect;

export interface RecordRef {
  kind: RecordKind;
  template: ArticleTemplateKey;
}

/** The world's live records among `ids`: which table each lives in and its template. Deleted, unknown or other-world ids are absent. */
export async function resolveRecords(worldId: string, ids: readonly string[], ex: Executor = db): Promise<Map<string, RecordRef>> {
  const list = [...new Set(ids)];
  const out = new Map<string, RecordRef>();
  if (list.length === 0) return out;
  const [ps, os, ts, as] = await Promise.all([
    ex.select({ id: people.id, kind: people.kind }).from(people).where(and(inArray(people.id, list), eq(people.worldId, worldId), isNull(people.deletedAt))),
    ex.select({ id: organizations.id }).from(organizations).where(and(inArray(organizations.id, list), eq(organizations.worldId, worldId), isNull(organizations.deletedAt))),
    ex.select({ id: territories.id }).from(territories).where(and(inArray(territories.id, list), eq(territories.worldId, worldId), isNull(territories.deletedAt))),
    ex.select({ id: articles.id, template: articles.template }).from(articles).where(and(inArray(articles.id, list), eq(articles.worldId, worldId), isNull(articles.deletedAt))),
  ]);
  for (const p of ps) out.set(p.id, { kind: "person", template: personTemplate(p.kind) });
  for (const o of os) out.set(o.id, { kind: "organization", template: "organization" });
  for (const t of ts) out.set(t.id, { kind: "territory", template: "territory" });
  for (const a of as) if (isArticleTemplate(a.template)) out.set(a.id, { kind: "article", template: a.template });
  return out;
}

/** The world's live relations, oldest first (Info Bar lists keep that order). */
export function listRelations(worldId: string, ex: Executor = db): Promise<RelationRow[]> {
  return ex
    .select()
    .from(relations)
    .where(and(eq(relations.worldId, worldId), isNull(relations.deletedAt)))
    .orderBy(asc(relations.createdAt));
}

const existingOf = (rows: readonly RelationRow[]): ExistingRelation[] => rows.map(({ id, type, fromId, toId, pairKey }) => ({ id, type, fromId, toId, pairKey }));

/** A relation that failed validation; `key`/`params` are an `errors` message for the route to word. */
export class RelationError extends Error {
  constructor(
    readonly key: MessageKey<"errors">,
    /** `type` holds the relation type's key; `relationTypeName` words it for the message. */
    readonly params?: Record<string, string>,
  ) {
    super(translate("en-US", "errors", key, params && { ...params, ...(params.type ? { type: relationTypeName(params.type, "en-US") } : {}) }));
  }
}

/** A relation type's name ("Parent of") in `locale`, or the key when it isn't a known type. */
export function relationTypeName(key: string, locale: Locale): string {
  const label = translate(locale, "relations", `type.${key}.label` as Parameters<typeof translate<"relations">>[2]);
  return label === `type.${key}.label` ? key : label;
}

/**
 * Validates and stores a relation (a POST body or a stored row merged with a
 * PATCH). `selfId` edits that row; otherwise a soft-deleted row of the same
 * type and pair comes back (keeping its notes) instead of a new one.
 */
export async function saveRelation(worldId: string, raw: Record<string, unknown>, ex: Executor = db, selfId?: string): Promise<RelationRow> {
  const fromId = typeof raw.fromId === "string" ? raw.fromId : "";
  const toId = typeof raw.toId === "string" ? raw.toId : "";
  const refs = await resolveRecords(worldId, [fromId, toId], ex);
  const live = await listRelations(worldId, ex);
  const checked = validateRelation(raw, { from: refs.get(fromId)?.template ?? null, to: refs.get(toId)?.template ?? null }, existingOf(live), selfId);
  if (!checked.ok) throw new RelationError(checked.error, checked.params);
  const values = { ...checked.value, fromKind: refs.get(fromId)!.kind, toKind: refs.get(toId)!.kind, updatedAt: new Date() };

  if (selfId) {
    const [row] = await ex.update(relations).set(values).where(eq(relations.id, selfId)).returning();
    return row;
  }
  if (values.type !== "custom") {
    const [gone] = await ex
      .select()
      .from(relations)
      .where(and(eq(relations.worldId, worldId), eq(relations.type, values.type), eq(relations.pairKey, values.pairKey), isNotNull(relations.deletedAt)))
      .orderBy(desc(relations.deletedAt))
      .limit(1);
    if (gone) {
      // Only the tie comes back; its notes, secrecy, dates and attitude were the user's and stay.
      const { type, fromId, toId, pairKey, fromKind, toKind, parentKind, spouseStatus, updatedAt } = values;
      const [row] = await ex
        .update(relations)
        .set({ type, fromId, toId, pairKey, fromKind, toKind, parentKind: gone.parentKind ?? parentKind, spouseStatus: gone.spouseStatus ?? spouseStatus, updatedAt, deletedAt: null })
        .where(eq(relations.id, gone.id))
        .returning();
      return row;
    }
  }
  const [row] = await ex.insert(relations).values({ ...values, worldId }).returning();
  return row;
}

/** The relation's fields as `saveRelation` input, for merging a PATCH over it. */
export function relationInput(row: RelationRow): Record<string, unknown> {
  const { type, fromId, toId, label, oneWay, secret, pinned, attitude, parentKind, spouseStatus, sinceDay, untilDay, notes } = row;
  return { type, fromId, toId, label, oneWay, secret, pinned, attitude, parentKind, spouseStatus, sinceDay, untilDay, notes };
}

export function softDeleteRelations(ids: readonly string[], ex: Executor = db) {
  if (ids.length === 0) return Promise.resolve();
  return ex.update(relations).set({ deletedAt: new Date(), updatedAt: new Date() }).where(inArray(relations.id, [...ids]));
}

/** A read-only edge computed from other tables (see DERIVED_KINDS). */
export interface ServerDerivedEdge {
  kind: "rules" | "seat";
  fromId: string;
  toId: string;
  label: string;
}

/** Rulers (authority assignments) and seats (a territory's capital/seat marker's linked articles), labeled in `locale`. */
export async function serverDerivedEdges(worldId: string, locale: Locale = "en-US"): Promise<ServerDerivedEdge[]> {
  const t = createTranslator(locale, "relations");
  const [authorities, seats] = await Promise.all([
    db.select().from(authorityAssignments).where(eq(authorityAssignments.worldId, worldId)),
    db.select().from(territorySeats).where(eq(territorySeats.worldId, worldId)),
  ]);
  const markerIds = [...new Set(seats.map((s) => s.markerId))];
  const links = markerIds.length ? await db.select().from(markerArticleLinks).where(inArray(markerArticleLinks.markerId, markerIds)) : [];
  const edges: ServerDerivedEdge[] = authorities.map((a) => ({ kind: "rules", fromId: a.holderId, toId: a.territoryId, label: a.title || authorityRoleLabel(a.role, createTranslator(locale, "politics")) }));
  for (const seat of seats) {
    for (const link of links.filter((l) => l.markerId === seat.markerId)) {
      edges.push({ kind: "seat", fromId: link.articleId, toId: seat.territoryId, label: seat.role === "capital" ? t("derived.capital") : t("derived.seat") });
    }
  }
  return edges;
}
