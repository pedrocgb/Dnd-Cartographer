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

export type InfoFieldKind = "text" | "select" | "link" | "color" | "url" | "date";
/**
 * A link points at articles of these templates (ids are unique across all
 * of them), or at a Calendars season profile ("seasonProfile") — the
 * article owns which profile it follows.
 */
export type InfoLinkTarget = ArticleTemplateKey | "seasonProfile";

export const SEASON_PROFILE_TARGET = "seasonProfile" as const;

/** What a measurement field measures; see MEASURE_EXAMPLES in server/settings/units. */
export type InfoMeasure = "height" | "weight" | "size" | "elevation" | "distance" | "area";

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
  /** A "text" field holding a measurement: its placeholder shows an example in the user's units. */
  measure?: InfoMeasure;
  /** Choices of a "select" field. */
  options?: readonly string[];
  /** A "select" storing several of its options. */
  multiple?: boolean;
  /** What a "link" field points at; `multiple` stores an id list. */
  link?: { targets: readonly InfoLinkTarget[]; multiple?: boolean };
  /** Stored in this record column rather than in `info`. */
  column?: string;
  /**
   * Backed by the relations table instead of `info` (a link field): the ids
   * are the other ends of this record's relations of `type` where it is on
   * `side` ("any" for symmetric types) and the other end's template is one of
   * `link.targets`. Saving the field adds and removes those relations, so the
   * other record shows the tie too (Bran's Parents list Anna once Anna's
   * Children list Bran). See src/server/relations/info-backing.ts.
   */
  relation?: { type: string; side: "from" | "to" | "any" };
  /** Always present (may stay empty): not in the add menu and not removable. Set through defineFieldSet's `required`. */
  required?: boolean;
}

export interface InfoFieldSet {
  groups: readonly InfoGroup[];
  /** Alphabetical within each group, groups in `groups` order. */
  fields: readonly InfoField[];
  /** Keys of the required fields, in display order (also the create form's order). */
  required: readonly string[];
}

export type InfoValue = string | string[] | null;
export type InfoValues = Record<string, InfoValue>;

export const MAX_INFO_TEXT_LENGTH = 200;
export const MAX_INFO_URL_LENGTH = 500;
const MAX_LIST_ITEMS = 50;

/**
 * A field set with its fields sorted alphabetically within each group.
 * `required` lists the always-present fields in the order they're shown;
 * a field already flagged `required` joins after them.
 */
export function defineFieldSet(groups: readonly InfoGroup[], fields: InfoField[], required: readonly string[] = []): InfoFieldSet {
  const unknown = required.filter((key) => !fields.some((f) => f.key === key));
  if (unknown.length) throw new Error(`Unknown required info field(s): ${unknown.join(", ")}`);
  const order = [...required, ...fields.filter((f) => f.required && !required.includes(f.key)).map((f) => f.key)];
  const marked = fields.map((f) => (order.includes(f.key) ? { ...f, required: true } : f));
  return {
    groups,
    fields: groups.flatMap((g) => marked.filter((f) => f.group === g.key).sort((a, b) => a.label.localeCompare(b.label))),
    required: order,
  };
}

/** The set's required fields, in display order. */
export const requiredFields = (set: InfoFieldSet): InfoField[] => set.required.flatMap((key) => set.fields.find((f) => f.key === key) ?? []);

/** Every required field, empty — a new record's starting `info`. */
export function emptyRequiredInfo(set: InfoFieldSet): InfoValues {
  return Object.fromEntries(requiredFields(set).map((f) => [f.key, isListField(f) ? [] : null]));
}

/** The options of another set's select field (to share one list, like Geography's biomes). */
export const optionsOf = (set: InfoFieldSet, key: string): readonly string[] => set.fields.find((f) => f.key === key)?.options ?? [];

export const link = (targets: InfoLinkTarget[], multiple = false) => ({ targets, multiple });

/** Whether a field stores a list (multi-select or multi-link). */
export const isListField = (field: InfoField) => Boolean(field.multiple || field.link?.multiple);

/**
 * Reserved `info` key: the keys of the fields kept secret (left out of share
 * links), plus INFO_NAME_SECRET when the record's name is too. It rides in
 * the same object as the values, so every save route keeps it.
 */
export const INFO_SECRETS_KEY = "$secrets";
export const INFO_NAME_SECRET = "$name";

/** The secret keys in an `info` object (or values from addedInfo). */
export function infoSecrets(values: InfoValues): string[] {
  const v = values[INFO_SECRETS_KEY];
  return Array.isArray(v) ? v : [];
}

/** Whether a record's raw `info` keeps its name secret. */
export const isNameSecret = (info: unknown) => infoSecrets(parseInfo(info)).includes(INFO_NAME_SECRET);

export function parseInfo(raw: unknown): InfoValues {
  if (typeof raw !== "string") return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as InfoValues) : {};
  } catch {
    return {};
  }
}

/**
 * A "date" field stores a world day ("wd:<day>"): physical days from the
 * world's epoch, so every calendar can show it. Free text written before the
 * field was a date is kept as it is until a date is picked.
 */
const WORLD_DAY_PREFIX = "wd:";
/** Same range the world's current day allows. */
const MAX_WORLD_DAY = 100_000_000;

export const encodeWorldDay = (day: number) => `${WORLD_DAY_PREFIX}${day}`;

/** The world day a "date" value holds, or null (empty, or older free text). */
export function parseWorldDay(value: unknown): number | null {
  if (typeof value !== "string" || !value.startsWith(WORLD_DAY_PREFIX)) return null;
  const day = Number(value.slice(WORLD_DAY_PREFIX.length));
  return Number.isSafeInteger(day) && Math.abs(day) <= MAX_WORLD_DAY ? day : null;
}

const isId = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 64;

/** A "color" field's value: #RRGGBB (uppercased), or null. */
export function sanitizeColor(value: unknown): string | null {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim().toUpperCase() : null;
}

/** A "url" field's value: an http(s) address, or null. */
export function sanitizeUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_INFO_URL_LENGTH) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:" ? trimmed : null;
  } catch {
    return null;
  }
}

function sanitizeValue(field: InfoField, value: unknown): InfoValue {
  const list = isListField(field);
  if (value === null || value === undefined || value === "") return list ? [] : null;
  if (field.kind === "text") return typeof value === "string" ? value.trim().slice(0, MAX_INFO_TEXT_LENGTH) || null : null;
  if (field.kind === "color") return sanitizeColor(value);
  if (field.kind === "url") return sanitizeUrl(value);
  if (field.kind === "date") {
    if (typeof value !== "string") return null;
    if (value.startsWith(WORLD_DAY_PREFIX)) {
      const day = parseWorldDay(value);
      return day === null ? null : encodeWorldDay(day);
    }
    return value.trim().slice(0, MAX_INFO_TEXT_LENGTH) || null;
  }
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
 * value checked against its field kind. A column or relation field keeps
 * just its key (value null) — that marks it as added while it's still empty.
 * Relation fields are saved by syncRelationFields (src/server/relations/sync.ts)
 * from the same PATCH, so a client must send the whole `info` object.
 * Null when `raw` isn't an object (the field isn't being patched).
 */
export function sanitizeInfo(set: InfoFieldSet, raw: unknown): InfoValues | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: InfoValues = {};
  // The client's key order is the user's display order (see addedInfo), so it's kept.
  for (const [key, value] of Object.entries(raw)) {
    const field = set.fields.find((f) => f.key === key);
    if (field) out[key] = field.column || field.relation ? null : sanitizeValue(field, value);
  }
  const secrets = keptSecrets(raw as InfoValues, (key) => key in out);
  if (secrets.length) out[INFO_SECRETS_KEY] = secrets;
  return out;
}

/** The valid secret keys of `info`: the name, or a field `has` (deduplicated). */
function keptSecrets(info: InfoValues, has: (key: string) => boolean): string[] {
  const raw = info[INFO_SECRETS_KEY];
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((k) => typeof k === "string" && (k === INFO_NAME_SECRET || has(k))))];
}

/**
 * The fields a record has added, with their values (column fields read from
 * their columns), in display order: required fields first, then the added
 * ones in their stored order (the order the user added or arranged them),
 * then any column field set before it had an `info` key (older data), then
 * any relation field with values but no key (the tie was made from the
 * other record: Bran's Parents after Anna listed him as a child).
 * `relationValues` holds the relation fields' values (relationFieldValues).
 */
export function addedInfo<T extends { info?: string }>(set: InfoFieldSet, record: T, relationValues: InfoValues = {}): InfoValues {
  const info = parseInfo(record.info);
  const columns = record as Record<string, unknown>;
  const columnValue = (field: InfoField) => {
    const raw = field.column ? columns[field.column] : undefined;
    return typeof raw === "string" && raw ? raw : null;
  };
  const empty = (field: InfoField): InfoValue => (isListField(field) ? [] : null);
  const valueOf = (field: InfoField): InfoValue =>
    field.column ? columnValue(field) : field.relation ? (relationValues[field.key] ?? empty(field)) : (info[field.key] ?? empty(field));
  const hasValue = (v: InfoValue | undefined) => (Array.isArray(v) ? v.length > 0 : Boolean(v));

  const out: InfoValues = {};
  for (const field of requiredFields(set)) out[field.key] = valueOf(field);
  for (const key of Object.keys(info)) {
    const field = set.fields.find((f) => f.key === key);
    if (field && !field.required) out[key] = valueOf(field);
  }
  for (const field of set.fields) if (field.column && !(field.key in out) && columnValue(field)) out[field.key] = columnValue(field);
  for (const field of set.fields) if (field.relation && !(field.key in out) && hasValue(relationValues[field.key])) out[field.key] = valueOf(field);
  const secrets = keptSecrets(info, (key) => key in out);
  if (secrets.length) out[INFO_SECRETS_KEY] = secrets;
  return out;
}

/** The column part of a PATCH body: each added column field's value (removed ones cleared). */
export function columnPatch(set: InfoFieldSet, values: InfoValues): Record<string, InfoValue> {
  const patch: Record<string, InfoValue> = {};
  for (const field of set.fields) if (field.column) patch[field.column] = values[field.key] ?? null;
  return patch;
}
