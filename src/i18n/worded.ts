import { activeT } from "./active";
import type { MessageKey, Namespace } from "./messages";

/**
 * `{ value: label }` for a list of stored values, each label worded on read
 * in the active language from `${prefix}.${value}` in `ns`. Callers keep
 * indexing it like a plain record.
 */
export function wordedLabels<V extends string | number>(ns: Namespace, values: readonly V[], prefix: string): Record<V, string> {
  const out = {} as Record<V, string>;
  for (const v of values) Object.defineProperty(out, v, { enumerable: true, get: () => activeT(ns)(`${prefix}.${v}` as MessageKey<typeof ns>) });
  return out;
}

/** Defines `fields` on `target` as getters worded on read from `${prefix}.${field}` in `ns`. */
export function wordedFields<T extends object>(target: T, ns: Namespace, prefix: string, fields: readonly (keyof T & string)[]): T {
  for (const f of fields) Object.defineProperty(target, f, { enumerable: true, configurable: true, get: () => activeT(ns)(`${prefix}.${f}` as MessageKey<typeof ns>) });
  return target;
}
