import type { ArticleTemplateKey } from "../articles/templates";

/**
 * Relation types: pure data shared by the server (validation, Info Bar
 * backing) and the client (pickers, graphs, legend). Stored rows reference
 * `key`, so keys never change.
 *
 * A row reads "from <label> to" (Anna — Parent of → Bran); seen from `to`
 * it reads with `inverseLabel` (Bran — Child of → Anna). Symmetric types
 * read the same from both ends and ignore direction (unless `oneWay`).
 */

/** "ecology" (Found in) backs Info Bar fields only: not in RELATION_GROUPS, never drawn. */
export type RelationGroup = "social" | "political" | "family" | "ecology" | "custom";
export type RelationLine = "solid" | "dotted" | "double";
export type FamilyRole = "parent" | "spouse" | "sibling" | "relative";
export type RelationAttr = "parentKind" | "spouseStatus";
/** Which templates an end accepts; "*" is any article. */
export type TemplateSet = readonly ArticleTemplateKey[] | "*";

export interface RelationTypeDef {
  key: string;
  group: RelationGroup;
  label: string;
  /** The label read from the `to` end (same as `label` when symmetric). */
  inverseLabel: string;
  symmetric: boolean;
  family?: FamilyRole;
  endpoints: { from: TemplateSet; to: TemplateSet };
  /** Chains of this type can't loop (no one is their own ancestor or liege). */
  acyclic?: boolean;
  color: string;
  /** Dashed is reserved for secret ties. */
  line: RelationLine;
  /** Extra attributes this type carries. */
  attrs?: readonly RelationAttr[];
  /** Only backs Info Bar fields: left out of graphs, the Relationships card and the add-relation picker. */
  hidden?: boolean;
}

export const RELATION_GROUPS: readonly { key: RelationGroup; label: string }[] = [
  { key: "family", label: "Family" },
  { key: "social", label: "Social" },
  { key: "political", label: "Political" },
  { key: "custom", label: "Custom" },
];

const PEOPLE = ["character", "playerCharacter"] as const;
const PEOPLE_ORGS = [...PEOPLE, "organization"] as const;
const FACTIONS = [...PEOPLE_ORGS, "territory", "military", "religion"] as const;
const POWERS = ["organization", "territory", "military", "religion"] as const;

const sym = (key: string, group: RelationGroup, label: string, endpoints: TemplateSet, color: string, line: RelationLine = "solid", extra: Partial<RelationTypeDef> = {}): RelationTypeDef => ({
  key,
  group,
  label,
  inverseLabel: label,
  symmetric: true,
  endpoints: { from: endpoints, to: endpoints },
  color,
  line,
  ...extra,
});

const dir = (key: string, group: RelationGroup, label: string, inverseLabel: string, from: TemplateSet, to: TemplateSet, color: string, line: RelationLine = "solid", extra: Partial<RelationTypeDef> = {}): RelationTypeDef => ({
  key,
  group,
  label,
  inverseLabel,
  symmetric: false,
  endpoints: { from, to },
  color,
  line,
  ...extra,
});

export const RELATION_TYPES: readonly RelationTypeDef[] = [
  // Family (people only)
  dir("parent", "family", "Parent of", "Child of", PEOPLE, PEOPLE, "#D4A24C", "solid", { family: "parent", acyclic: true, attrs: ["parentKind"] }),
  sym("spouse", "family", "Spouse of", PEOPLE, "#E879A6", "double", { family: "spouse", attrs: ["spouseStatus"] }),
  sym("sibling", "family", "Sibling of", PEOPLE, "#C08A3E", "solid", { family: "sibling" }),
  sym("relative", "family", "Relative of", PEOPLE, "#A8895A", "dotted", { family: "relative" }),
  // Social
  sym("ally", "social", "Ally of", FACTIONS, "#22C55E"),
  sym("friend", "social", "Friend of", PEOPLE, "#4ADE80"),
  sym("lover", "social", "Lover of", PEOPLE, "#F472B6"),
  sym("rival", "social", "Rival of", FACTIONS, "#F59E0B"),
  sym("enemy", "social", "Enemy of", FACTIONS, "#EF4444"),
  dir("mentor", "social", "Mentor of", "Student of", PEOPLE_ORGS, PEOPLE, "#38BDF8"),
  // Political
  dir("liege", "political", "Liege of", "Vassal of", FACTIONS, FACTIONS, "#A855F7", "solid", { acyclic: true }),
  dir("memberOf", "political", "Member of", "Has member", PEOPLE_ORGS, POWERS, "#818CF8"),
  dir("leads", "political", "Leads", "Led by", PEOPLE_ORGS, [...POWERS, "settlement", "building"], "#C084FC"),
  dir("serves", "political", "Serves", "Employs", PEOPLE_ORGS, FACTIONS, "#60A5FA"),
  dir("patron", "political", "Patron of", "Patron", PEOPLE_ORGS, "*", "#2DD4BF"),
  dir("founded", "political", "Founded", "Founded by", PEOPLE_ORGS, "*", "#94A3B8", "dotted"),
  dir("branch", "political", "Parent organization of", "Part of", ["organization", "military", "religion"], ["organization", "military", "religion"], "#6366F1", "solid", { acyclic: true }),
  sym("treaty", "political", "Treaty with", POWERS, "#14B8A6", "double"),
  sym("atWar", "political", "At war with", FACTIONS, "#DC2626", "double"),
  // Ecology (Info Bar only): where a creature or plant lives
  dir("foundIn", "ecology", "Found in", "Home of", ["fauna", "flora", "monster"], ["territory", "geography", "building"], "#65A30D", "dotted", { hidden: true }),
  // Anything else, named by its label
  dir("custom", "custom", "Related to", "Related to", "*", "*", "#9CA3AF"),
];

/**
 * Edges computed from other data (never stored): shown read-only on graphs
 * and in the legend/filters.
 */
export const DERIVED_KINDS = [
  { key: "house", label: "Member of house", color: "#D4A24C", line: "dotted" },
  { key: "rules", label: "Rules", color: "#C084FC", line: "dotted" },
  { key: "seat", label: "Seat of", color: "#94A3B8", line: "dotted" },
  { key: "territoryParent", label: "Vassal of", color: "#A855F7", line: "dotted" },
  { key: "linked", label: "Linked", color: "#6B7280", line: "dotted" },
] as const satisfies readonly { key: string; label: string; color: string; line: RelationLine }[];
export type DerivedKind = (typeof DERIVED_KINDS)[number]["key"];

export const PARENT_KINDS = ["biological", "adoptive", "step"] as const;
export type ParentKind = (typeof PARENT_KINDS)[number];
export const SPOUSE_STATUSES = ["married", "betrothed", "divorced", "widowed", "lover", "unknown"] as const;
export type SpouseStatus = (typeof SPOUSE_STATUSES)[number];

export const RECORD_KINDS = ["person", "organization", "territory", "article"] as const;
export type RecordKind = (typeof RECORD_KINDS)[number];

export const ATTITUDE_MIN = -3;
export const ATTITUDE_MAX = 3;
export const MAX_RELATION_LABEL = 80;
export const MAX_RELATION_NOTES = 2000;

const BY_KEY = new Map(RELATION_TYPES.map((t) => [t.key, t]));

export function relationType(key: string): RelationTypeDef | undefined {
  return BY_KEY.get(key);
}

export function allows(set: TemplateSet, template: ArticleTemplateKey): boolean {
  return set === "*" || set.includes(template);
}

/** The duplicate-check key of a pair for a type: direction matters unless symmetric. */
export function pairKeyOf(type: RelationTypeDef, fromId: string, toId: string): string {
  if (!type.symmetric) return `${fromId}|${toId}`;
  return fromId < toId ? `${fromId}|${toId}` : `${toId}|${fromId}`;
}

/** The fields every relation shape has, stored or not. */
export interface RelationEnds {
  type: string;
  fromId: string;
  toId: string;
  label?: string;
}

/** How the relation reads from `perspectiveId`'s side ("Child of", "Ally of"), a custom label replacing "Related to". */
export function labelFor(rel: RelationEnds, perspectiveId: string): string {
  const type = relationType(rel.type);
  if (!type) return rel.label || rel.type;
  if (type.key === "custom") return rel.label || type.label;
  return perspectiveId === rel.toId ? type.inverseLabel : type.label;
}

/** One way to phrase a new relation from the current record: the type, and whether the current record is its `to` end. */
export interface PerspectiveOption {
  type: string;
  label: string;
  group: RelationGroup;
  /** The current record goes on the `to` end ("Child of" = parent row with the other record as `from`). */
  swap: boolean;
}

/** Every phrasing allowed between a record of template `self` and one of template `other`, in registry order. */
export function perspectiveOptions(self: ArticleTemplateKey, other: ArticleTemplateKey): PerspectiveOption[] {
  const out: PerspectiveOption[] = [];
  for (const t of RELATION_TYPES) {
    if (t.hidden) continue;
    if (allows(t.endpoints.from, self) && allows(t.endpoints.to, other)) out.push({ type: t.key, label: t.label, group: t.group, swap: false });
    if (!t.symmetric && t.key !== "custom" && allows(t.endpoints.from, other) && allows(t.endpoints.to, self)) {
      out.push({ type: t.key, label: t.inverseLabel, group: t.group, swap: true });
    }
  }
  return out;
}
