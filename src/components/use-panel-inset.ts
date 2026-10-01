"use client";

import { useEffect, useState } from "react";

/** The lateral panels pinned to the canvas's left edge (tool panels, marker panel). */
const PANEL_SELECTOR = ":scope > .marker-side-panel, :scope > .zones-panel, :scope > .grid-panel, :scope > .layers-panel, :scope > .markers-panel";

/**
 * How far the open lateral panel reaches into the canvas area (px), so the
 * floating buttons sit right of it whatever its width: one column, two
 * (an item's or a folder's settings), or narrowed on small screens.
 * Follows panels opening, closing and resizing (layout width, so the
 * slide-in animation doesn't count).
 */
export function usePanelInset(area: HTMLElement | null): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (!area) return;
    const resize = new ResizeObserver(() => measure());
    let watched: Element[] = [];
    function measure() {
      const panels = [...area!.querySelectorAll<HTMLElement>(PANEL_SELECTOR)];
      if (panels.length !== watched.length || panels.some((p, i) => p !== watched[i])) {
        resize.disconnect();
        panels.forEach((p) => resize.observe(p));
        watched = panels;
      }
      setInset(Math.max(0, ...panels.map((p) => p.offsetLeft + p.offsetWidth)));
    }
    // Panels mount and unmount as direct children; a class change widens one.
    const mutations = new MutationObserver(measure);
    mutations.observe(area, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    measure();
    return () => {
      mutations.disconnect();
      resize.disconnect();
    };
  }, [area]);

  return inset;
}
