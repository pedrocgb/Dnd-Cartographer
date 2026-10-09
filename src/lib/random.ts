/** A source of uniform numbers in [0, 1): Math.random, or a fixed sequence in tests. */
export type Rng = () => number;

export function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)];
}

/** An integer in [min, max], both included. */
export function randInt(min: number, max: number, rng: Rng): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/**
 * Picks a value with a chance proportional to its weight. Weights of 0 or
 * less never win; throws when no entry has a positive weight.
 */
export function weightedPick<T>(entries: readonly (readonly [T, number])[], rng: Rng): T {
  const valid = entries.filter(([, weight]) => weight > 0);
  if (!valid.length) throw new Error("weightedPick: no entry has a positive weight");
  const total = valid.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = rng() * total;
  for (const [value, weight] of valid) {
    roll -= weight;
    if (roll < 0) return value;
  }
  return valid[valid.length - 1][0];
}
