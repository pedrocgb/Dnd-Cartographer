import { weightedPick, type Rng } from "../random";
import type { ResolvedInputs } from "./inputs";
import type { Age, Condition, Founding, Growth, Purpose, RecentChange } from "./options";
import type { Purposes } from "./purposes";

/**
 * Everything rolled so far, flat, so a rule can weigh any of it by name.
 * Fields rolled later are missing while earlier steps run.
 */
export interface SettlementContext extends ResolvedInputs {
  primary: Purpose;
  /** The primary purpose and the secondary ones. */
  purposes: readonly Purpose[];
  founding: Founding;
  foundingDetail: string;
  age: Age;
  growth: Growth;
  condition: Condition;
  recentChange: RecentChange;
}

export function contextOf(
  inputs: ResolvedInputs,
  purposes: Purposes,
  origins: Pick<SettlementContext, "founding" | "foundingDetail" | "age" | "growth" | "condition" | "recentChange">
): SettlementContext {
  return { ...inputs, primary: purposes.primary, purposes: [purposes.primary, ...purposes.secondary], ...origins };
}

/**
 * One option of a rolled table. `by.<field>` multiplies the weight by the
 * factor of the context's value of that field; for a list field (purposes),
 * by the factor of each member. Missing factors are ×1.
 */
export interface Rule<K extends string, C> {
  key: K;
  weight?: number;
  /** When false, the option can't come up here. */
  requires?: (ctx: C) => boolean;
  by?: { [F in keyof C]?: Partial<Record<string, number>> };
}

export function ruleWeight<K extends string, C>(rule: Rule<K, C>, ctx: C): number {
  if (rule.requires && !rule.requires(ctx)) return 0;
  let weight = rule.weight ?? 1;
  for (const field in rule.by) {
    const table = rule.by[field]!;
    const value: unknown = ctx[field];
    if (Array.isArray(value)) for (const v of value) weight *= table[v as string] ?? 1;
    else if (typeof value === "string") weight *= table[value] ?? 1;
  }
  return weight;
}

export function rollRule<K extends string, C>(rules: readonly Rule<K, C>[], ctx: C, rng: Rng): K {
  return weightedPick(
    rules.map((r) => [r.key, ruleWeight(r, ctx)] as const),
    rng
  );
}

/** Up to `n` different options; fewer when no more can come up. */
export function rollRules<K extends string, C>(rules: readonly Rule<K, C>[], ctx: C, n: number, rng: Rng): K[] {
  const weighted = rules.map((r) => [r.key, ruleWeight(r, ctx)] as [K, number]);
  const picked: K[] = [];
  while (picked.length < n) {
    const left = weighted.filter(([key, w]) => w > 0 && !picked.includes(key));
    if (!left.length) break;
    picked.push(weightedPick(left, rng));
  }
  return picked;
}

/** Whether an option could come up here at all. */
export function ruleAllowed<K extends string, C>(rules: readonly Rule<K, C>[], key: K, ctx: C): boolean {
  const rule = rules.find((r) => r.key === key);
  return !!rule && (!rule.requires || rule.requires(ctx));
}
