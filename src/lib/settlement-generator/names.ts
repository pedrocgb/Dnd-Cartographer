import { pick, weightedPick, type Rng } from "../random";
import type { Purpose, SettlementType } from "./options";

/** Names that suit the same purposes (empty `tags`: any settlement of the type). */
export interface NameGroup {
  tags: readonly Purpose[];
  names: readonly string[];
}
/** One settlement type's names, built from docs/settlements-names-list. */
export type NamePool = readonly NameGroup[];

/** How much more likely a group is when its tags match the primary or a secondary purpose. */
const PRIMARY_BONUS = 8;
const SECONDARY_BONUS = 2;
/** Rerolls before accepting a recently used name. */
const AVOID_TRIES = 6;

/**
 * Picks a name: first a group, weighted by its size and by how well its tags
 * fit the purposes, then any name in it. Constant work per pick whatever the
 * list's size. Names in `avoid` (e.g. the recent ones) are rerolled a few times.
 */
export function pickName(
  pool: NamePool,
  purposes: { primary: Purpose; secondary: readonly Purpose[] },
  rng: Rng,
  avoid: ReadonlySet<string> = new Set()
): string {
  const fit = (g: NameGroup) =>
    1 + (g.tags.includes(purposes.primary) ? PRIMARY_BONUS : 0) + (g.tags.some((t) => purposes.secondary.includes(t)) ? SECONDARY_BONUS : 0);
  const groups = pool.map((g) => [g, g.names.length * fit(g)] as const);
  let name = "";
  for (let i = 0; i < AVOID_TRIES; i++) {
    name = pick(weightedPick(groups, rng).names, rng);
    if (!avoid.has(name)) break;
  }
  return name;
}

const cache = new Map<SettlementType, Promise<NamePool>>();

/** One type's names, fetched as its own chunk the first time it's needed. */
export function loadNamePool(type: SettlementType): Promise<NamePool> {
  let pool = cache.get(type);
  if (!pool) {
    pool = import(`./names/${type.toLowerCase()}.json`).then((m: { default: NamePool }) => m.default);
    pool.catch(() => cache.delete(type));
    cache.set(type, pool);
  }
  return pool;
}
