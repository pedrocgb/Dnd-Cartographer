"use client";

import { useState } from "react";
import type { DropPlace } from "./multi-select";

export interface DropSpot {
  /** The row dropped on: an item's id, or a folder's key. */
  key: string;
  place: DropPlace;
}

type RowProps = Pick<React.HTMLAttributes<HTMLElement>, "onDragStart" | "onDragEnd" | "onDragOver" | "onDragLeave" | "onDrop"> & { draggable?: boolean };

/**
 * Drag and drop inside a tree list: item rows are dragged (with the rest of
 * the selection when they're part of it) and dropped above or below another
 * item, or onto a folder row to go in at its end. What a drop does is the
 * caller's `onDrop`; this only tracks the drag and where it would land.
 */
export function useListDrag(onDrop: (ids: string[], spot: DropSpot) => void) {
  const [dragIds, setDragIds] = useState<string[] | null>(null);
  const [spot, setSpot] = useState<DropSpot | null>(null);

  const end = () => {
    setDragIds(null);
    setSpot(null);
  };
  const show = (next: DropSpot) => setSpot((prev) => (prev?.key === next.key && prev.place === next.place ? prev : next));
  const leave = (key: string) => (e: React.DragEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSpot((prev) => (prev?.key === key ? null : prev));
  };
  const drop = (next: DropSpot | null) => (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    if (dragIds && next) onDrop(dragIds, next);
    end();
  };
  const halfOf = (e: React.DragEvent<HTMLElement>): DropPlace => {
    const r = e.currentTarget.getBoundingClientRect();
    return e.clientY < r.top + r.height / 2 ? "before" : "after";
  };

  /** An item row: dragged when `canDrag`, `idsOf` gives what moves with it; dropped next to when `canDrop`. */
  function itemProps(key: string, { canDrag, canDrop, idsOf }: { canDrag: boolean; canDrop: boolean; idsOf: () => string[] }): RowProps {
    const accepts = () => Boolean(dragIds && canDrop && !dragIds.includes(key));
    return {
      draggable: canDrag,
      onDragStart: (e) => {
        if (!canDrag) return;
        e.stopPropagation();
        const ids = idsOf();
        e.dataTransfer.effectAllowed = "move";
        // Firefox starts a drag only with some data set.
        e.dataTransfer.setData("text/plain", ids.join(","));
        setDragIds(ids);
      },
      onDragEnd: end,
      onDragOver: (e) => {
        if (!accepts()) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
        show({ key, place: halfOf(e) });
      },
      onDragLeave: leave(key),
      onDrop: (e) => {
        e.stopPropagation();
        drop(accepts() ? { key, place: halfOf(e) } : null)(e);
      },
    };
  }

  /** A folder row: dropping on it moves the dragged items in, at the end. */
  function folderProps(key: string, canDrop: boolean): RowProps {
    return {
      onDragOver: (e) => {
        if (!dragIds || !canDrop) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        show({ key, place: "into" });
      },
      onDragLeave: leave(key),
      onDrop: (e) => drop(dragIds && canDrop ? { key, place: "into" } : null)(e),
    };
  }

  return {
    itemProps,
    folderProps,
    /** Where a drop on this row would land, for its indicator. */
    placeOf: (key: string): DropPlace | null => (spot?.key === key ? spot.place : null),
    isDragged: (id: string) => Boolean(dragIds?.includes(id)),
  };
}
