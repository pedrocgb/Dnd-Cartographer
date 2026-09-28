/**
 * Node placement for relationship graphs. Pure and deterministic (same
 * graph, same picture), so a web doesn't reshuffle between visits.
 */

export interface Point {
  x: number;
  y: number;
}

export interface LayoutEdge {
  fromId: string;
  toId: string;
}

/** Room one card takes on the canvas. */
export const NODE_SPACING = 220;

/**
 * Focus in the middle, one ring per hop around it; each ring spread evenly,
 * its members kept near the parent that reached them.
 */
export function radialLayout(focusId: string, ids: readonly string[], edges: readonly LayoutEdge[]): Record<string, Point> {
  const next = new Map<string, string[]>();
  for (const e of edges) {
    next.set(e.fromId, [...(next.get(e.fromId) ?? []), e.toId]);
    next.set(e.toId, [...(next.get(e.toId) ?? []), e.fromId]);
  }
  const wanted = new Set(ids);
  const rings: string[][] = [[focusId]];
  const seen = new Set([focusId]);
  while (rings[rings.length - 1].length) {
    const ring: string[] = [];
    for (const id of rings[rings.length - 1]) {
      for (const n of [...(next.get(id) ?? [])].sort()) {
        if (seen.has(n) || !wanted.has(n)) continue;
        seen.add(n);
        ring.push(n);
      }
    }
    rings.push(ring);
  }
  // Anything unreachable goes on an outer ring.
  const rest = ids.filter((id) => !seen.has(id));
  if (rest.length) rings.push(rest);

  const out: Record<string, Point> = { [focusId]: { x: 0, y: 0 } };
  rings.slice(1).forEach((ring, i) => {
    if (!ring.length) return;
    const radius = (i + 1) * NODE_SPACING * Math.max(1, ring.length / (6 * (i + 1)));
    ring.forEach((id, k) => {
      const angle = (2 * Math.PI * k) / ring.length - Math.PI / 2;
      out[id] = { x: Math.round(radius * Math.cos(angle)), y: Math.round(radius * Math.sin(angle)) };
    });
  });
  return out;
}

/**
 * A spring layout (Fruchterman–Reingold): tied cards pull together, every
 * pair pushes apart, cooling over a fixed number of rounds. Starts from a
 * sunflower spiral in id order, so the result is always the same.
 */
export function forceLayout(ids: readonly string[], edges: readonly LayoutEdge[], rounds = 300): Record<string, Point> {
  const n = ids.length;
  const index = new Map(ids.map((id, i) => [id, i]));
  const k = NODE_SPACING;
  const golden = Math.PI * (3 - Math.sqrt(5));
  const xs = ids.map((_, i) => Math.sqrt(i + 0.5) * k * 0.6 * Math.cos(i * golden));
  const ys = ids.map((_, i) => Math.sqrt(i + 0.5) * k * 0.6 * Math.sin(i * golden));
  const links = edges.flatMap((e) => {
    const a = index.get(e.fromId);
    const b = index.get(e.toId);
    return a === undefined || b === undefined || a === b ? [] : [[a, b] as const];
  });

  let temperature = k * Math.sqrt(n);
  const cooling = temperature / (rounds + 1);
  for (let round = 0; round < rounds; round++) {
    const dx = new Float64Array(n);
    const dy = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const ddx = xs[i] - xs[j] || 0.01;
        const ddy = ys[i] - ys[j] || 0.01;
        const dist2 = ddx * ddx + ddy * ddy;
        const push = (k * k) / dist2;
        dx[i] += ddx * push;
        dy[i] += ddy * push;
        dx[j] -= ddx * push;
        dy[j] -= ddy * push;
      }
    }
    for (const [a, b] of links) {
      const ddx = xs[a] - xs[b];
      const ddy = ys[a] - ys[b];
      const dist = Math.sqrt(ddx * ddx + ddy * ddy) || 0.01;
      const pull = dist / k;
      dx[a] -= ddx * pull;
      dy[a] -= ddy * pull;
      dx[b] += ddx * pull;
      dy[b] += ddy * pull;
    }
    for (let i = 0; i < n; i++) {
      // A weak pull to the middle keeps separate clusters from drifting off.
      dx[i] -= xs[i] * 0.01;
      dy[i] -= ys[i] * 0.01;
      const len = Math.sqrt(dx[i] * dx[i] + dy[i] * dy[i]) || 1;
      const step = Math.min(len, temperature);
      xs[i] += (dx[i] / len) * step;
      ys[i] += (dy[i] / len) * step;
    }
    temperature = Math.max(1, temperature - cooling);
  }
  return Object.fromEntries(ids.map((id, i) => [id, { x: Math.round(xs[i]), y: Math.round(ys[i]) }]));
}
