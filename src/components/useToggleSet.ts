"use client";

import { useState } from "react";

/** A Set-of-selected-values with "All" semantics: selecting every value in
 * the universe is indistinguishable from "no filter applied" for that facet. */
export function useToggleSet(universe: string[]) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(universe));
  const allOn = selected.size === universe.length;

  function toggle(value: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(universe));
  }

  function clearAll() {
    setSelected(new Set());
  }

  return { selected, allOn, toggle, selectAll, clearAll };
}
