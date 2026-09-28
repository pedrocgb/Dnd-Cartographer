"use client";

import type { GraphEdge } from "@/server/relations/graph";
import { DERIVED_KINDS, relationType, type RelationLine } from "@/server/relations/types";
import { attitudeColor } from "./edge-style";

function Swatch({ color, line, secret = false }: { color: string; line: RelationLine; secret?: boolean }) {
  const dash = secret ? "8 5" : line === "dotted" ? "2 4" : undefined;
  return (
    <svg width="28" height="10" aria-hidden>
      <line x1="1" y1="5" x2="27" y2="5" stroke={color} strokeWidth={line === "double" ? 3 : 1.5} strokeDasharray={dash} />
    </svg>
  );
}

/** The line styles present in the view: one entry per relation type or derived kind, plus secrets and the attitude scale. */
export default function RelationsLegend({ edges, attitudeMode }: { edges: readonly GraphEdge[]; attitudeMode: boolean }) {
  const types = [...new Set(edges.map((e) => e.type))];
  const entries = types.flatMap((key) => {
    const t = relationType(key);
    if (t) return [{ key, label: t.symmetric || key === "custom" ? t.label : `${t.label} / ${t.inverseLabel}`, color: t.color, line: t.line }];
    const d = DERIVED_KINDS.find((x) => x.key === key);
    return d ? [{ key, label: `${d.label} (from other information)`, color: d.color, line: d.line as RelationLine }] : [];
  });
  if (entries.length === 0) return null;
  return (
    <ul className="rel-legend" aria-label="Legend">
      {!attitudeMode &&
        entries.map((e) => (
          <li key={e.key}>
            <Swatch color={e.color} line={e.line} />
            {e.label}
          </li>
        ))}
      {attitudeMode && (
        <li>
          {[-3, -1, 0, 1, 3].map((a) => (
            <Swatch key={a} color={attitudeColor(a)} line="solid" />
          ))}
          Hostile … devoted
        </li>
      )}
      {edges.some((e) => e.secret) && (
        <li>
          <Swatch color="#9CA3AF" line="solid" secret />
          Secret
        </li>
      )}
    </ul>
  );
}
