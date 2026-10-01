/*
 * Small view preferences remembered in localStorage (open folders, a chosen
 * tab). Read them through useSyncExternalStore(subscribeToStorage, ...): the
 * server (and hydration) render sees none, then React re-renders with the
 * stored value. Reading localStorage in a useState initializer instead makes
 * the first client render differ from the server HTML (hydration error).
 */

export function subscribeToStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

export function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null; // storage unavailable
  }
}

export function writeStored(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // storage unavailable: the choice just isn't remembered
  }
}

/** A stored JSON list of ids; empty when missing or corrupt. */
export function parseIdList(raw: string | null): Set<string> {
  try {
    const parsed: unknown = JSON.parse(raw ?? "[]");
    if (Array.isArray(parsed)) return new Set(parsed.filter((x): x is string => typeof x === "string"));
  } catch {
    // corrupt: start collapsed
  }
  return new Set();
}
