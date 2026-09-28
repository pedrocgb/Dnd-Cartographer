"use client";

import { useMemo } from "react";
import { neighborhood, type GraphEdge } from "@/server/relations/graph";
import { forceLayout, radialLayout } from "@/server/relations/layout";
import type { CanvasCard, CanvasLine } from "./RelationsCanvas";
import { useRelations } from "./relations-context";

/** Beyond this many cards the whole-world web asks for a focus instead of laying everything out. */
const MAX_WEB_CARDS = 400;

/** Cards and lines for the records within reach of `focusId` (or every tied record), laid out. */
export function useWebGraph(focusId: string | null, depth: number, edges: GraphEdge[]) {
  const { catalog } = useRelations();
  return useMemo(() => {
    const ids = focusId
      ? [...neighborhood(edges, focusId, depth)]
      : [...new Set(edges.flatMap((e) => [e.fromId, e.toId]))].sort();
    const shown = new Set(ids);
    const lines = edges.filter((e) => shown.has(e.fromId) && shown.has(e.toId));
    if (!focusId && ids.length > MAX_WEB_CARDS) return { cards: [] as CanvasCard[], lines: [] as CanvasLine[], tooMany: ids.length };
    const at = focusId ? radialLayout(focusId, ids, lines) : forceLayout(ids, lines, ids.length > 200 ? 150 : 300);
    const cards: CanvasCard[] = ids.flatMap((id) => {
      const entry = catalog.get(id);
      return entry ? [{ kind: "record" as const, id, position: at[id] ?? { x: 0, y: 0 }, entry, focus: id === focusId }] : [];
    });
    return { cards, lines: lines.map((edge) => ({ kind: "graph" as const, edge })), tooMany: 0 };
  }, [focusId, depth, edges, catalog]);
}

