import type { ArticleTemplateKey } from "./templates";

/**
 * Article Info Bar fields: the shared shape and helpers. Each template's
 * fields live in src/server/articles/info-sets/ — pure data shared by the
 * client (menu, editors) and the server (sanitizeInfo).
 *
 * Values live in the record's `info` column as `{ [key]: value }`; a key
 * being present means the field was added (even while empty). Fields with a
 * `column` keep their value in that record column instead (other features
 * query it), and `info` holds only the key as a presence marker.
 */

export type InfoFieldKind = "text" | "select" | "link";
/** A link points at articles of these templates (ids are unique across all of them). */
export type InfoLinkTarget = ArticleTemplateKey;

export interface InfoGroup {
  key: string;
  label: string;
}

export interface InfoField {
  /** camelCase storage key — never rename. */
  key: string;
  label: string;
  /** An InfoGroup key of the field's set. */
  group: string;
  kind: InfoFieldKind;
  /** Shown from the ? button in edit mode: what goes here, and why it matters. */
  hint: string;
  /** Choices of a "select" field. */
  options?: readonly string[];
  /** A "select" storing several of its options. */
  multiple?: boolean;
  /** What a "link" field points at; `multiple` stores an id list. */
  link?: { targets: readonly InfoLinkTarget[]; multiple?: boolean };
  /** Stored in this record column rather than in `info`. */
  column?: string;
  /** Always present: not in the add menu and not removable. */
  required?: boolean;
}

export interface InfoFieldSet {
  groups: readonly InfoGroup[];
  /** Alphabetical within each group, groups in `groups` order. */
  fields: readonly InfoField[];
}

export type InfoValue = string | string[] | null;
export type InfoValues = Record<string, InfoValue>;

export const MAX_INFO_TEXT_LENGTH = 200;
const MAX_LIST_ITEMS = 50;

/** A field set with its fields sorted alphabetically within each group. */
export function defineFieldSet(groups: readonly InfoGroup[], fields: InfoField[]): InfoFieldSet {
  return {
    groups,
    fields: groups.flatMap((g) => fields.filter((f) => f.group === g.key).sort((a, b) => a.label.localeCompare(b.label))),
  };
}

export const link = (targets: InfoLinkTarget[], multiple = false) => ({ targets, multiple });

/** Whether a field stores a list (multi-select or multi-link). */
export const isListField = (field: InfoField) => Boolean(field.multiple || field.link?.multiple);

export function parseInfo(raw: unknown): InfoValues {
  if (typeof raw !== "string") return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as InfoValues) : {};
  } catch {
    return {};
  }
}

const isId = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 64;

function sanitizeValue(field: InfoField, value: unknown): InfoValue {
  const list = isListField(field);
  if (value === null || value === undefined || value === "") return list ? [] : null;
  if (field.kind === "text") return typeof value === "string" ? value.trim().slice(0, MAX_INFO_TEXT_LENGTH) || null : null;
  if (field.kind === "select") {
    const valid = (v: unknown): v is string => typeof v === "string" && Boolean(field.options?.includes(v));
    if (list) return Array.isArray(value) ? [...new Set(value.filter(valid))] : [];
    return valid(value) ? value : null;
  }
  if (list) return Array.isArray(value) ? [...new Set(value.filter(isId))].slice(0, MAX_LIST_ITEMS) : [];
  return isId(value) ? value : null;
}

/**
 * The storable form of a PATCHed `info` object: known fields only, each
 * value checked against its field kind. A column field keeps just its key
 * (value null) — that marks it as added while its column is still empty.
 * Null when `raw` isn't an object (the field isn't being patched).
 */
export function sanitizeInfo(set: InfoFieldSet, raw: unknown): InfoValues | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: InfoValues = {};
  // The client's key order is the user's display order (see addedInfo), so it's kept.
  for (const [key, value] of Object.entries(raw)) {
    const field = set.fields.find((f) => f.key === key);
    if (field) out[key] = field.column ? null : sanitizeValue(field, value);
  }
  return out;
}

/**
 * The fields a record has added, with their values (column fields read from
 * their columns), in display order: required fields first, then the added
 * ones in their stored order (the order the user added or arranged them),
 * then any column field set before it had an `info` key (older data).
 */
export function addedInfo<T extends { info?: string }>(set: InfoFieldSet, record: T): InfoValues {
  const info = parseInfo(record.info);
  const columns = record as Record<string, unknown>;
  const columnValue = (field: InfoField) => {
    const raw = field.column ? columns[field.column] : undefined;
    return typeof raw === "string" && raw ? raw : null;
  };
  const valueOf = (field: InfoField): InfoValue => (field.column ? columnValue(field) : (info[field.key] ?? (isListField(field) ? [] : null)));

  const out: InfoValues = {};
  for (const field of set.fields) if (field.required) out[field.key] = valueOf(field);
  for (const key of Object.keys(info)) {
    const field = set.fields.find((f) => f.key === key);
    if (field && !field.required) out[key] = valueOf(field);
  }
  for (const field of set.fields) if (field.column && !(field.key in out) && columnValue(field)) out[field.key] = columnValue(field);
  return out;
}

/** The column part of a PATCH body: each added column field's value (removed ones cleared). */
export function columnPatch(set: InfoFieldSet, values: InfoValues): Record<string, InfoValue> {
  const patch: Record<string, InfoValue> = {};
  for (const field of set.fields) if (field.column) patch[field.column] = values[field.key] ?? null;
  return patch;
}
