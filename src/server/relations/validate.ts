import type { ArticleTemplateKey } from "../articles/templates";
import type { MessageKey } from "../../i18n/messages";
import {
  allows,
  ATTITUDE_MAX,
  ATTITUDE_MIN,
  MAX_RELATION_LABEL,
  MAX_RELATION_NOTES,
  PARENT_KINDS,
  pairKeyOf,
  relationType,
  SPOUSE_STATUSES,
  type ParentKind,
  type SpouseStatus,
} from "./types";

/** A relation's stored fields, as validation sees them. */
export interface RelationFields {
  type: string;
  fromId: string;
  toId: string;
  label: string;
  oneWay: boolean;
  secret: boolean;
  pinned: boolean;
  attitude: number | null;
  parentKind: ParentKind | null;
  spouseStatus: SpouseStatus | null;
  sinceDay: number | null;
  untilDay: number | null;
  notes: string;
}

/** A live relation already stored (for duplicate and cycle checks). */
export interface ExistingRelation {
  id: string;
  type: string;
  fromId: string;
  toId: string;
  pairKey: string;
}

/** On failure, `error` is an `errors` key (worded by the route, see `RelationError`). */
export type Validated = { ok: true; value: RelationFields & { pairKey: string } } | { ok: false; error: MessageKey<"errors">; params?: Record<string, string> };

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const day = (v: unknown) => (typeof v === "number" && Number.isInteger(v) ? v : null);

/**
 * Normalizes a relation from untrusted input (a POST body, or a stored row
 * merged with a PATCH) and checks it: known type, both ends allowed for it,
 * not self-related, no duplicate of a live relation, no loop through an
 * acyclic type (parent, liege, branch), a sensible date span. `selfId` is the
 * relation being edited (left out of the checks).
 */
export function validateRelation(
  raw: Record<string, unknown>,
  templates: { from: ArticleTemplateKey | null; to: ArticleTemplateKey | null },
  existing: readonly ExistingRelation[],
  selfId?: string
): Validated {
  const type = relationType(typeof raw.type === "string" ? raw.type : "");
  if (!type) return { ok: false, error: "relationTypeUnknown" };
  const fromId = typeof raw.fromId === "string" ? raw.fromId : "";
  const toId = typeof raw.toId === "string" ? raw.toId : "";
  if (!templates.from || !templates.to) return { ok: false, error: "relationEndsMissing" };
  if (fromId === toId) return { ok: false, error: "relationSelf" };
  if (!allows(type.endpoints.from, templates.from) || !allows(type.endpoints.to, templates.to)) {
    return { ok: false, error: "relationTypeMismatch", params: { type: type.key } };
  }

  const label = str(raw.label, MAX_RELATION_LABEL);
  if (type.key === "custom" && !label) return { ok: false, error: "relationLabelRequired" };
  const attitude = typeof raw.attitude === "number" && Number.isFinite(raw.attitude) ? Math.round(raw.attitude) : null;
  if (attitude !== null && (attitude < ATTITUDE_MIN || attitude > ATTITUDE_MAX)) return { ok: false, error: "relationAttitudeRange", params: { min: String(ATTITUDE_MIN), max: String(ATTITUDE_MAX) } };
  const sinceDay = day(raw.sinceDay);
  const untilDay = day(raw.untilDay);
  if (sinceDay !== null && untilDay !== null && sinceDay > untilDay) return { ok: false, error: "relationDatesReversed" };

  const attrs = type.attrs ?? [];
  const parentKind = attrs.includes("parentKind") ? ((PARENT_KINDS as readonly unknown[]).includes(raw.parentKind) ? (raw.parentKind as ParentKind) : "biological") : null;
  const spouseStatus = attrs.includes("spouseStatus") ? ((SPOUSE_STATUSES as readonly unknown[]).includes(raw.spouseStatus) ? (raw.spouseStatus as SpouseStatus) : "unknown") : null;

  const pairKey = pairKeyOf(type, fromId, toId);
  const others = existing.filter((r) => r.id !== selfId);
  if (type.key !== "custom" && others.some((r) => r.type === type.key && r.pairKey === pairKey)) {
    return { ok: false, error: "relationDuplicate", params: { type: type.key } };
  }
  if (type.acyclic && reaches(others.filter((r) => r.type === type.key), toId, fromId)) {
    return { ok: false, error: "relationLoop", params: { type: type.key } };
  }

  return {
    ok: true,
    value: {
      type: type.key,
      fromId,
      toId,
      label,
      oneWay: type.symmetric ? raw.oneWay === true : false,
      secret: raw.secret === true,
      pinned: raw.pinned === true,
      attitude,
      parentKind,
      spouseStatus,
      sinceDay,
      untilDay,
      notes: str(raw.notes, MAX_RELATION_NOTES),
      pairKey,
    },
  };
}

/** Whether `target` can be reached from `start` following from -> to. */
function reaches(edges: readonly ExistingRelation[], start: string, target: string): boolean {
  const next = new Map<string, string[]>();
  for (const e of edges) next.set(e.fromId, [...(next.get(e.fromId) ?? []), e.toId]);
  const seen = new Set<string>();
  const stack = [start];
  while (stack.length) {
    const id = stack.pop()!;
    if (id === target) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...(next.get(id) ?? []));
  }
  return false;
}
