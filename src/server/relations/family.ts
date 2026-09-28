/**
 * Family trees from parent and spouse relations. Pure (vitest imports it).
 *
 * A child hangs from a "union": the set of its parents in view (any number
 * of them). Partners who share a child without a spouse tie still get a
 * union (drawn dotted, "inferred"); a child with a single known parent gets
 * an "Unknown" partner card, so half-siblings by different partners stay
 * apart. Spouses without children form a union too.
 */

export interface FamilyRelation {
  type: string;
  fromId: string;
  toId: string;
  parentKind: string | null;
  spouseStatus?: string | null;
}

export interface FamilyOptions {
  /** Only blood relatives of the focus (all generations), plus their partners as faint in-laws. */
  bloodline?: boolean;
  /** Generations shown above and below the focus in the family view. */
  up?: number;
  down?: number;
  /** Bloodline view: show partners who aren't blood relatives. */
  inLaws?: boolean;
}

export const ROW_HEIGHT = 170;
export const CARD_WIDTH = 180;
export const CARD_GAP = 40;

export interface FamilyNode {
  id: string;
  kind: "person" | "unknown" | "union";
  x: number;
  y: number;
  generation: number;
  /** A partner who isn't a blood relative (bloodline view). */
  faint?: boolean;
  /** Union of parents with no spouse tie between them. */
  inferred?: boolean;
}

export interface FamilyLine {
  id: string;
  source: string;
  target: string;
  style: "blood" | "adoptive" | "spouse" | "inferred";
}

export interface FamilyTree {
  nodes: FamilyNode[];
  lines: FamilyLine[];
}

const isBlood = (r: FamilyRelation) => r.type === "parent" && (r.parentKind === null || r.parentKind === "biological");

/** Who is shown, and on which generation (the focus is 0, parents −1). */
export function selectFamily(focusId: string, relations: readonly FamilyRelation[], opts: FamilyOptions = {}): { generation: Map<string, number>; faint: Set<string> } {
  const parents = relations.filter((r) => r.type === "parent");
  const spouses = relations.filter((r) => r.type === "spouse");
  const generation = new Map<string, number>([[focusId, 0]]);
  const faint = new Set<string>();

  if (opts.bloodline) {
    const blood = parents.filter(isBlood);
    // Every biological ancestor, then everyone descending from one of them.
    const queue = [focusId];
    while (queue.length) {
      const id = queue.shift()!;
      for (const r of blood) {
        if (r.toId === id && !generation.has(r.fromId)) {
          generation.set(r.fromId, generation.get(id)! - 1);
          queue.push(r.fromId);
        }
      }
    }
    const down = [...generation.keys()];
    while (down.length) {
      const id = down.shift()!;
      for (const r of blood) {
        if (r.fromId === id && !generation.has(r.toId)) {
          generation.set(r.toId, generation.get(id)! + 1);
          down.push(r.toId);
        }
      }
    }
    if (opts.inLaws !== false) {
      const members = [...generation.keys()];
      for (const id of members) {
        const partners = [
          ...spouses.flatMap((r) => (r.fromId === id ? [r.toId] : r.toId === id ? [r.fromId] : [])),
          // Co-parents of a blood child.
          ...blood.filter((r) => r.fromId === id).flatMap((r) => blood.filter((o) => o.toId === r.toId && o.fromId !== id).map((o) => o.fromId)),
        ];
        for (const p of partners) {
          if (generation.has(p)) continue;
          generation.set(p, generation.get(id)!);
          faint.add(p);
        }
      }
    }
    return { generation, faint };
  }

  const up = opts.up ?? 2;
  const down = opts.down ?? 2;
  const queue = [focusId];
  while (queue.length) {
    const id = queue.shift()!;
    const g = generation.get(id)!;
    const steps: [string, number][] = [
      ...parents.filter((r) => r.toId === id).map((r) => [r.fromId, g - 1] as [string, number]),
      ...parents.filter((r) => r.fromId === id).map((r) => [r.toId, g + 1] as [string, number]),
      ...spouses.flatMap((r) => (r.fromId === id ? [[r.toId, g]] : r.toId === id ? [[r.fromId, g]] : []) as [string, number][]),
    ];
    for (const [other, og] of steps) {
      if (generation.has(other) || og < -up || og > down) continue;
      generation.set(other, og);
      queue.push(other);
    }
  }
  return { generation, faint };
}

/** Lays out the selected people by generation, with union dots between partners and their children. */
export function layoutFamily(
  focusId: string,
  relations: readonly FamilyRelation[],
  opts: FamilyOptions = {},
  nameOf: (id: string) => string = (id) => id
): FamilyTree {
  const { generation, faint } = selectFamily(focusId, relations, opts);
  const shown = (id: string) => generation.has(id);
  const parentRels = relations.filter((r) => r.type === "parent" && shown(r.fromId) && shown(r.toId) && (!opts.bloodline || isBlood(r) || faint.has(r.fromId)));
  const spouseRels = relations.filter((r) => r.type === "spouse" && shown(r.fromId) && shown(r.toId));
  const married = new Set(spouseRels.map((r) => [r.fromId, r.toId].sort().join("|")));

  // Unions: each child's parent set (biological first; adoptive ones only when it has no other).
  const unions = new Map<string, { parents: string[]; children: string[]; inferred: boolean }>();
  const adoptiveLines: FamilyLine[] = [];
  const unknownOf = new Map<string, string>(); // unknown card id -> its partner
  const children = [...new Set(parentRels.map((r) => r.toId))];
  for (const child of children) {
    const own = parentRels.filter((r) => r.toId === child);
    const blood = own.filter(isBlood);
    const placing = blood.length ? blood : own;
    for (const r of own) if (!placing.includes(r)) adoptiveLines.push({ id: `adopt:${r.fromId}:${child}`, source: r.fromId, target: child, style: "adoptive" });
    let ids = [...new Set(placing.map((r) => r.fromId))].sort();
    if (ids.length === 1) {
      const unknown = `unknown:${ids[0]}`;
      unknownOf.set(unknown, ids[0]);
      ids = [ids[0], unknown];
    }
    const key = ids.join("|");
    const union = unions.get(key) ?? { parents: ids, children: [], inferred: false };
    union.children.push(child);
    if (ids.length === 2 && !ids.some((i) => i.startsWith("unknown:")) && !married.has(key)) union.inferred = true;
    if (ids.length > 2) union.inferred = !ids.every((a) => ids.every((b) => a >= b || married.has(`${a}|${b}`)));
    unions.set(key, union);
  }
  for (const key of married) if (!unions.has(key)) unions.set(key, { parents: key.split("|"), children: [], inferred: false });
  for (const [unknown, partner] of unknownOf) generation.set(unknown, generation.get(partner)!);

  // Partner clusters per generation: people sharing a union sit side by side.
  const partnersOf = new Map<string, Set<string>>();
  for (const u of unions.values()) {
    for (const a of u.parents) for (const b of u.parents) if (a !== b) partnersOf.set(a, (partnersOf.get(a) ?? new Set()).add(b));
  }
  const byName = (a: string, b: string) => nameOf(a).localeCompare(nameOf(b)) || a.localeCompare(b);
  const people = [...generation.keys()];
  const clusterOf = new Map<string, string[]>();
  for (const id of [...people].sort(byName)) {
    if (clusterOf.has(id)) continue;
    // The member with most partners goes in the middle, partners alternate around it.
    const members: string[] = [];
    const stack = [id];
    while (stack.length) {
      const m = stack.pop()!;
      if (members.includes(m)) continue;
      if (generation.get(m) !== generation.get(id)) continue;
      members.push(m);
      stack.push(...(partnersOf.get(m) ?? []));
    }
    members.sort((a, b) => (partnersOf.get(b)?.size ?? 0) - (partnersOf.get(a)?.size ?? 0) || byName(a, b));
    const ordered: string[] = [];
    members.forEach((m, i) => (i % 2 ? ordered.unshift(m) : ordered.push(m)));
    for (const m of ordered) clusterOf.set(m, ordered);
  }

  // Rows top-down; each cluster sits under the union(s) its members descend from.
  const x = new Map<string, number>();
  const unionX = new Map<string, number>();
  const rows = [...new Set(people.map((p) => generation.get(p)!))].sort((a, b) => a - b);
  const step = CARD_WIDTH + CARD_GAP;
  for (const g of rows) {
    const clusters = [...new Set(people.filter((p) => generation.get(p) === g).map((p) => clusterOf.get(p)!))];
    const keyOf = (cluster: string[]) => {
      const xs = [...unions.entries()].filter(([k, u]) => unionX.has(k) && u.children.some((c) => cluster.includes(c))).map(([k]) => unionX.get(k)!);
      return xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : Number.POSITIVE_INFINITY;
    };
    const keyed = clusters.map((c, i) => ({ c, key: keyOf(c), i })).sort((a, b) => a.key - b.key || a.i - b.i);
    let cursor = Number.NEGATIVE_INFINITY;
    for (const { c, key } of keyed) {
      const width = c.length * step;
      let start = Number.isFinite(key) ? key - width / 2 + step / 2 : cursor;
      if (!Number.isFinite(start)) start = 0;
      start = Math.max(start, cursor);
      c.forEach((m, i) => x.set(m, start + i * step));
      cursor = start + width;
    }
    for (const [key, u] of unions) {
      if (generation.get(u.parents[0]) !== g) continue;
      const xs = u.parents.map((p) => x.get(p)!).filter((v) => v !== undefined);
      unionX.set(key, xs.reduce((s, v) => s + v, 0) / xs.length);
    }
  }

  const nodes: FamilyNode[] = people.map((id) => ({
    id,
    kind: id.startsWith("unknown:") ? "unknown" : "person",
    x: Math.round(x.get(id) ?? 0),
    y: generation.get(id)! * ROW_HEIGHT,
    generation: generation.get(id)!,
    ...(faint.has(id) ? { faint: true } : {}),
  }));
  const lines: FamilyLine[] = [...adoptiveLines];
  for (const [key, u] of unions) {
    const id = `union:${key}`;
    const g = generation.get(u.parents[0])!;
    // The dot sits between the partners, a bit below their row.
    nodes.push({ id, kind: "union", x: Math.round((unionX.get(key) ?? 0) + CARD_WIDTH / 2 - 5), y: g * ROW_HEIGHT + ROW_HEIGHT / 2, generation: g, ...(u.inferred ? { inferred: true } : {}) });
    for (const p of u.parents) lines.push({ id: `${id}:p:${p}`, source: p, target: id, style: u.inferred ? "inferred" : "spouse" });
    for (const c of u.children) lines.push({ id: `${id}:c:${c}`, source: id, target: c, style: "blood" });
  }
  return { nodes, lines };
}
