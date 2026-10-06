import type { Species } from "./options";
import type { NameCollection } from "./parse-names";

const cache = new Map<Species, Promise<NameCollection>>();

/** One species' names, fetched as its own chunk the first time it's needed. */
export function loadNames(species: Species): Promise<NameCollection> {
  let names = cache.get(species);
  if (!names) {
    names = import(`./names/${species}.json`).then((m: { default: NameCollection }) => m.default);
    names.catch(() => cache.delete(species));
    cache.set(species, names);
  }
  return names;
}
