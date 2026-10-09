/**
 * How one rolled value bends the odds of another: `table[a][b]` multiplies
 * the weight of `b` when `a` is known. Missing entries leave the odds as they are (×1).
 */
export type Weights<A extends string, B extends string> = Partial<Record<A, Partial<Record<B, number>>>>;

export function factor<A extends string, B extends string>(table: Weights<A, B>, a: A, b: B): number {
  return table[a]?.[b] ?? 1;
}
