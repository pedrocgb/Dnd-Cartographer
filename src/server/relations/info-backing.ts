import type { InfoField, InfoFieldSet, InfoValues } from "../articles/info-fields";
import type { ArticleTemplateKey } from "../articles/templates";

/** The parts of a relation the Info Bar needs. */
export interface BackingRelation {
  type: string;
  fromId: string;
  toId: string;
  oneWay?: boolean;
}

export type TemplateOf = (id: string) => ArticleTemplateKey | null;

/** The other end of `rel` when it belongs to `field` on record `recordId`, else null. */
export function otherEndFor(field: InfoField, recordId: string, rel: BackingRelation, templateOf: TemplateOf): string | null {
  const backing = field.relation;
  if (!backing || rel.type !== backing.type) return null;
  let other: string | null = null;
  if (backing.side === "from" || backing.side === "any") other = rel.fromId === recordId ? rel.toId : null;
  // A one-way symmetric tie belongs to the end that holds it (its `from`) only.
  if (!other && (backing.side === "to" || (backing.side === "any" && !rel.oneWay))) other = rel.toId === recordId ? rel.fromId : null;
  if (!other) return null;
  const template = templateOf(other);
  return template && field.link?.targets.includes(template) ? other : null;
}

/** Relation-backed field values of a record, in relation order (single fields take the first). */
export function relationFieldValues(set: InfoFieldSet, recordId: string, relations: readonly BackingRelation[], templateOf: TemplateOf): InfoValues {
  const out: InfoValues = {};
  for (const field of set.fields) {
    if (!field.relation) continue;
    const ids = [...new Set(relations.flatMap((r) => otherEndFor(field, recordId, r, templateOf) ?? []))];
    out[field.key] = field.link?.multiple ? ids : (ids[0] ?? null);
  }
  return out;
}

/** The ids a saved value asks for (a single link is a one-item list). */
export function wantedIds(value: unknown): string[] {
  if (Array.isArray(value)) return [...new Set(value.filter((v): v is string => typeof v === "string" && v.length > 0 && v.length <= 64))];
  return typeof value === "string" && value ? [value] : [];
}
