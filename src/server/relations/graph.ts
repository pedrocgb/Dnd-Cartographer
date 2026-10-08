import { parseInfo } from "../articles/info-fields";
import { INFO_FIELD_SETS, personInfoSet } from "../articles/info-sets";
import { isArticleTemplate, personTemplate, type ArticleTemplateKey } from "../articles/templates";
import { derivedLabel, labelFor, relationType, type DerivedKind, type RelationGroup } from "./types";

/**
 * Relationship graphs, built in the browser from the article lists the
 * Articles page already holds. Pure (vitest imports it directly).
 */

/** The fields of each record kind the graphs read. */
export interface GraphInput {
  people: readonly { id: string; name: string; kind: string; houseId: string | null; portraitKey: string | null; info: string }[];
  organizations: readonly { id: string; name: string; kind: string; color: string | null; portraitKey: string | null; info: string }[];
  territories: readonly { id: string; name: string; parentId: string | null; portraitKey: string | null; info: string }[];
  articles: readonly { id: string; title: string; template: string; portraitKey: string | null; info: string }[];
}

export interface CatalogEntry {
  id: string;
  name: string;
  template: ArticleTemplateKey;
  portraitKey: string | null;
  /** A character's house (organization id), or null. */
  houseId: string | null;
  /** The house color it wears: its house's color for a character, its own for an organization. */
  color: string | null;
  info: string;
}

export type Catalog = Map<string, CatalogEntry>;

export function buildCatalog(input: GraphInput): Catalog {
  const catalog: Catalog = new Map();
  const orgColor = new Map(input.organizations.map((o) => [o.id, o.color]));
  for (const p of input.people) {
    catalog.set(p.id, { id: p.id, name: p.name, template: personTemplate(p.kind), portraitKey: p.portraitKey, houseId: p.houseId, color: (p.houseId && orgColor.get(p.houseId)) || null, info: p.info });
  }
  for (const o of input.organizations) catalog.set(o.id, { id: o.id, name: o.name, template: "organization", portraitKey: o.portraitKey, houseId: null, color: o.color, info: o.info });
  for (const t of input.territories) catalog.set(t.id, { id: t.id, name: t.name, template: "territory", portraitKey: t.portraitKey, houseId: null, color: null, info: t.info });
  for (const a of input.articles) {
    if (isArticleTemplate(a.template)) catalog.set(a.id, { id: a.id, name: a.title, template: a.template, portraitKey: a.portraitKey, houseId: null, color: null, info: a.info });
  }
  return catalog;
}

/** A stored relation as the graphs read it. */
export interface GraphRelation {
  id: string;
  type: string;
  fromId: string;
  toId: string;
  label: string;
  oneWay: boolean;
  secret: boolean;
  pinned: boolean;
  attitude: number | null;
  parentKind: string | null;
  spouseStatus: string | null;
  sinceDay: number | null;
  untilDay: number | null;
}

/** An edge computed from other data, never stored (read-only). */
export interface DerivedEdge {
  id: string;
  kind: DerivedKind;
  fromId: string;
  toId: string;
  /** How it reads from `fromId` ("Member of house", "Count", "Linked: Headquarters"). */
  label: string;
}

/** Rulers and seats, computed by the server (it has the authority and seat tables). */
export interface ServerDerivedInput {
  kind: "rules" | "seat";
  fromId: string;
  toId: string;
  label: string;
}

/**
 * Read-only edges: a character's house, a territory's parent, rulers and
 * seats, and every plain Info Bar link (not relation-backed, not a column)
 * as "linked". Edges to records missing from the catalog are dropped.
 */
export function derivedEdges(catalog: Catalog, server: readonly ServerDerivedInput[], input: GraphInput): DerivedEdge[] {
  const out: DerivedEdge[] = [];
  const add = (kind: DerivedKind, fromId: string, toId: string, label: string) => {
    if (fromId !== toId && catalog.has(fromId) && catalog.has(toId)) out.push({ id: `${kind}:${fromId}:${toId}:${label}`, kind, fromId, toId, label });
  };
  for (const p of input.people) if (p.houseId) add("house", p.id, p.houseId, derivedLabel("house"));
  for (const t of input.territories) if (t.parentId) add("territoryParent", t.id, t.parentId, derivedLabel("territoryParent"));
  for (const e of server) add(e.kind, e.fromId, e.toId, e.label);

  for (const entry of catalog.values()) {
    const set = entry.template === "character" || entry.template === "playerCharacter" ? personInfoSet(entry.template === "playerCharacter" ? "player" : "npc") : INFO_FIELD_SETS[entry.template];
    if (!set) continue;
    const info = parseInfo(entry.info);
    for (const field of set.fields) {
      if (field.kind !== "link" || field.relation || field.column) continue;
      const value = info[field.key];
      for (const id of Array.isArray(value) ? value : value ? [value] : []) add("linked", entry.id, id, field.label);
    }
  }
  return out;
}

/** A relation or derived edge as a graph draws it. */
export interface GraphEdge {
  id: string;
  fromId: string;
  toId: string;
  /** Relation type key, or the derived kind. */
  type: string;
  group: RelationGroup | "derived";
  derived: boolean;
  label: string;
  secret: boolean;
  directed: boolean;
  attitude: number | null;
  relation?: GraphRelation;
}

export interface WebFilters {
  hideSecrets?: boolean;
  /** Relation groups to show (all when empty or missing). */
  groups?: readonly RelationGroup[];
  showDerived?: boolean;
  /** The plain Info Bar links: many, so off unless asked for. */
  showLinked?: boolean;
  /** Only ties in force on this world day (open ends count as in force). */
  asOfDay?: number | null;
  /** Record templates to keep (all when empty or missing). */
  templates?: readonly ArticleTemplateKey[];
}

const inForce = (r: GraphRelation, day: number | null | undefined) =>
  day === null || day === undefined || ((r.sinceDay === null || r.sinceDay <= day) && (r.untilDay === null || r.untilDay >= day));

/**
 * Every edge the filters keep, between records the catalog has. A derived
 * edge already covered by a relation between the same pair is left out.
 */
export function webEdges(catalog: Catalog, relations: readonly GraphRelation[], derived: readonly DerivedEdge[], filters: WebFilters = {}): GraphEdge[] {
  const keep = (id: string) => {
    const entry = catalog.get(id);
    return Boolean(entry) && (!filters.templates?.length || filters.templates.includes(entry!.template));
  };
  const pair = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const edges: GraphEdge[] = [];
  const related = new Set<string>();
  for (const r of relations) {
    const type = relationType(r.type);
    if (!type || type.hidden || !keep(r.fromId) || !keep(r.toId)) continue;
    related.add(pair(r.fromId, r.toId));
    if (filters.hideSecrets && r.secret) continue;
    if (filters.groups?.length && !filters.groups.includes(type.group)) continue;
    if (!inForce(r, filters.asOfDay)) continue;
    const base = labelFor(r, r.fromId);
    edges.push({
      id: r.id,
      fromId: r.fromId,
      toId: r.toId,
      type: r.type,
      group: type.group,
      derived: false,
      label: r.label && type.key !== "custom" ? `${base} · ${r.label}` : base,
      secret: r.secret,
      directed: !type.symmetric || r.oneWay,
      attitude: r.attitude,
      relation: r,
    });
  }
  if (filters.showDerived !== false) {
    for (const d of derived) {
      if (d.kind === "linked" && !filters.showLinked) continue;
      if (!keep(d.fromId) || !keep(d.toId) || related.has(pair(d.fromId, d.toId))) continue;
      edges.push({ id: d.id, fromId: d.fromId, toId: d.toId, type: d.kind, group: "derived", derived: true, label: d.label, secret: false, directed: true, attitude: null });
    }
  }
  return edges;
}

/** Records within `depth` hops of `focusId` over `edges` (the focus included). */
export function neighborhood(edges: readonly GraphEdge[], focusId: string, depth: number): Set<string> {
  const next = new Map<string, string[]>();
  for (const e of edges) {
    next.set(e.fromId, [...(next.get(e.fromId) ?? []), e.toId]);
    next.set(e.toId, [...(next.get(e.toId) ?? []), e.fromId]);
  }
  const seen = new Set([focusId]);
  let frontier = [focusId];
  for (let d = 0; d < depth && frontier.length; d++) {
    const nextFrontier: string[] = [];
    for (const id of frontier) {
      for (const n of next.get(id) ?? []) {
        if (seen.has(n)) continue;
        seen.add(n);
        nextFrontier.push(n);
      }
    }
    frontier = nextFrontier;
  }
  return seen;
}

/** Siblings by shared biological or adoptive parents: "full" when every parent is shared. */
export function derivedSiblings(relations: readonly GraphRelation[], personId: string): { id: string; full: boolean }[] {
  const parentsOf = (id: string) => new Set(relations.filter((r) => r.type === "parent" && r.toId === id).map((r) => r.fromId));
  const mine = parentsOf(personId);
  if (mine.size === 0) return [];
  const candidates = new Set(relations.filter((r) => r.type === "parent" && mine.has(r.fromId) && r.toId !== personId).map((r) => r.toId));
  return [...candidates].map((id) => {
    const theirs = parentsOf(id);
    return { id, full: theirs.size === mine.size && [...mine].every((p) => theirs.has(p)) };
  });
}
