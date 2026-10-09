import type { Node } from "@xyflow/react";
import type { BoardGroup } from "@/server/relations/boards";

/** Room around a group's cards, and its title strip on top. */
const PAD = 24;
const HEAD = 30;
/** Until React Flow has measured a card. */
const FALLBACK = { width: 190, height: 60 };

export const GROUP_NODE_PREFIX = "group:";
export const groupNodeId = (groupId: string) => `${GROUP_NODE_PREFIX}${groupId}`;
export const isGroupNodeId = (id: string) => id.startsWith(GROUP_NODE_PREFIX);
export const groupIdOf = (nodeId: string) => nodeId.slice(GROUP_NODE_PREFIX.length);

/** The frame around a group's cards (their live positions and sizes), or null when none is on the canvas. */
export function groupFrame(group: BoardGroup, nodesById: Map<string, Node>) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const id of group.members) {
    const n = nodesById.get(id);
    if (!n) continue;
    const width = n.measured?.width ?? n.width ?? FALLBACK.width;
    const height = n.measured?.height ?? n.height ?? FALLBACK.height;
    minX = Math.min(minX, n.position.x);
    minY = Math.min(minY, n.position.y);
    maxX = Math.max(maxX, n.position.x + width);
    maxY = Math.max(maxY, n.position.y + height);
  }
  if (minX === Infinity) return null;
  return {
    position: { x: minX - PAD, y: minY - PAD - HEAD },
    width: maxX - minX + 2 * PAD,
    height: maxY - minY + 2 * PAD + HEAD,
  };
}
