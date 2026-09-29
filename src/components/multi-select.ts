"use client";

import { useCallback, useMemo, useState } from "react";

/**
 * Multi-selection for lists of items (map zones, lines, texts, …): a plain
 * click picks one item, Ctrl/Cmd+click adds or removes one, Shift+click picks
 * everything between the last clicked item and this one, in the list's order.
 * The pure parts (selection steps, mixed values, drop reordering) are tested
 * in tests/multi-select.test.ts.
 */

export interface Selection {
  /** In the order they were picked. */
  ids: string[];
  /** The last item clicked without Shift: where a Shift range starts. */
  anchor: string | null;
}

export const EMPTY_SELECTION: Selection = { ids: [], anchor: null };

export interface ClickMods {
  /** Ctrl/Cmd: add or remove one item. */
  toggle: boolean;
  /** Shift: everything from the anchor to this item. */
  range: boolean;
}

export const clickMods = (e: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }): ClickMods => ({ toggle: e.ctrlKey || e.metaKey, range: e.shiftKey });

/** The selection after clicking `id`; `order` is the list as shown, for Shift ranges. */
export function clickSelection(sel: Selection, id: string, mods: ClickMods, order: readonly string[]): Selection {
  const from = sel.anchor ? order.indexOf(sel.anchor) : -1;
  const to = order.indexOf(id);
  if (mods.range && from !== -1 && to !== -1) {
    const range = order.slice(Math.min(from, to), Math.max(from, to) + 1);
    // Ctrl+Shift adds the range to what's already picked.
    return { ids: mods.toggle ? [...new Set([...sel.ids, ...range])] : range, anchor: sel.anchor };
  }
  if (mods.toggle) return { ids: sel.ids.includes(id) ? sel.ids.filter((x) => x !== id) : [...sel.ids, id], anchor: id };
  return { ids: [id], anchor: id };
}

const same = (a: unknown, b: unknown) => Object.is(a, b) || (typeof a === "object" && typeof b === "object" && JSON.stringify(a) === JSON.stringify(b));

/** The fields whose value differs between the items (arrays and objects compared by content). */
export function mixedKeys<T extends object>(items: readonly T[], keys?: readonly (keyof T)[]): Set<string> {
  const mixed = new Set<string>();
  const [first, ...rest] = items;
  if (!first) return mixed;
  for (const key of keys ?? (Object.keys(first) as (keyof T)[])) {
    if (rest.some((item) => !same(item[key], first[key]))) mixed.add(String(key));
  }
  return mixed;
}

/** Layers every item is also shown on, and those only some are. */
export function sharedLayers(lists: readonly (readonly string[] | undefined)[]): { all: string[]; some: string[] } {
  const count = new Map<string, number>();
  for (const list of lists) for (const id of new Set(list ?? [])) count.set(id, (count.get(id) ?? 0) + 1);
  const all = [...count].filter(([, n]) => n === lists.length).map(([id]) => id);
  const some = [...count].filter(([, n]) => n < lists.length).map(([id]) => id);
  return { all, some };
}

/** Adds and removes layers from one item's list (a multi-selection's "Also show on" edit). */
export function editLayers(list: readonly string[] | undefined, add: readonly string[], remove: readonly string[]): string[] {
  const next = (list ?? []).filter((id) => !remove.includes(id));
  return [...next, ...add.filter((id) => !next.includes(id))];
}

export type DropPlace = "before" | "after" | "into";

/**
 * A folder's items after dropping `moving` next to `anchorId` (or at the end
 * for "into"): every item's new place as its sortOrder, only the changed ones.
 * `list` is the target folder as shown; `moving` in the order they should land.
 */
export function dropOrder(list: readonly { id: string; sortOrder: number }[], moving: readonly string[], anchorId: string | null, place: DropPlace): { id: string; sortOrder: number }[] {
  const staying = list.filter((item) => !moving.includes(item.id)).map((item) => item.id);
  let at = staying.length;
  if (place !== "into" && anchorId) {
    const i = staying.indexOf(anchorId);
    if (i !== -1) at = place === "before" ? i : i + 1;
  }
  const next = [...staying.slice(0, at), ...moving, ...staying.slice(at)];
  const current = new Map(list.map((item) => [item.id, item.sortOrder]));
  return next.map((id, sortOrder) => ({ id, sortOrder })).filter(({ id, sortOrder }) => current.get(id) !== sortOrder);
}

/**
 * A drop's changes per item: the new sortOrder of every moved or shifted item
 * of the target folder, plus the folder for those coming from another one.
 */
export function dropMoves(
  target: readonly { id: string; sortOrder: number }[],
  moving: readonly string[],
  anchorId: string | null,
  place: DropPlace,
  folderOf: (id: string) => string | null,
  targetFolder: string | null
): Map<string, { folder?: string | null; sortOrder: number }> {
  const out = new Map<string, { folder?: string | null; sortOrder: number }>();
  for (const { id, sortOrder } of dropOrder(target, moving, anchorId, place)) out.set(id, folderOf(id) === targetFolder ? { sortOrder } : { folder: targetFolder, sortOrder });
  return out;
}

export interface SelectionApi {
  ids: string[];
  /** The one selected item, or null (nothing, or several). */
  single: string | null;
  /** The last item clicked without Shift. */
  anchor: string | null;
  has: (id: string) => boolean;
  /** Plain select of one item (or none). */
  select: (id: string | null) => void;
  click: (id: string, mods: ClickMods, order: readonly string[]) => void;
  set: (ids: string[]) => void;
  /** Drops items from the selection (deleted, gone from the layer). */
  remove: (ids: readonly string[]) => void;
}

export function useSelection(): SelectionApi {
  const [sel, setSel] = useState<Selection>(EMPTY_SELECTION);
  const select = useCallback((id: string | null) => setSel((prev) => (id ? (prev.ids.length === 1 && prev.ids[0] === id ? prev : { ids: [id], anchor: id }) : prev.ids.length ? EMPTY_SELECTION : prev)), []);
  const click = useCallback((id: string, mods: ClickMods, order: readonly string[]) => setSel((prev) => clickSelection(prev, id, mods, order)), []);
  const set = useCallback((ids: string[]) => setSel((prev) => ({ ids, anchor: ids.includes(prev.anchor ?? "") ? prev.anchor : (ids[0] ?? null) })), []);
  const remove = useCallback(
    (ids: readonly string[]) =>
      setSel((prev) => {
        if (!prev.ids.some((id) => ids.includes(id))) return prev;
        const left = prev.ids.filter((id) => !ids.includes(id));
        return { ids: left, anchor: prev.anchor && left.includes(prev.anchor) ? prev.anchor : (left[0] ?? null) };
      }),
    []
  );
  return useMemo(() => {
    const picked = new Set(sel.ids);
    return { ids: sel.ids, single: sel.ids.length === 1 ? sel.ids[0] : null, anchor: sel.anchor, has: (id: string) => picked.has(id), select, click, set, remove };
  }, [sel, select, click, set, remove]);
}
