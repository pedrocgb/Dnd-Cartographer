"use client";

import type { Clock } from "@/server/quests/types";
import { useT } from "@/i18n/useT";

/** One pie wedge of the ring, from segment `i` of `n` (starting at 12 o'clock, clockwise). */
function wedge(i: number, n: number, r: number) {
  const a0 = (i / n) * 2 * Math.PI - Math.PI / 2;
  const a1 = ((i + 1) / n) * 2 * Math.PI - Math.PI / 2;
  const [x0, y0, x1, y1] = [Math.cos(a0) * r, Math.sin(a0) * r, Math.cos(a1) * r, Math.sin(a1) * r];
  return `M0 0 L${x0.toFixed(3)} ${y0.toFixed(3)} A${r} ${r} 0 0 1 ${x1.toFixed(3)} ${y1.toFixed(3)} Z`;
}

/**
 * A progress clock (Blades in the Dark): a circle split into segments, the
 * filled ones shaded. With `onSet`, clicking a segment fills the clock up to
 * it (clicking the last filled one empties it back by one).
 */
export default function ProgressClock({ clock, size = 64, onSet, disabled }: { clock: Clock; size?: number; onSet?: (filled: number) => void; disabled?: boolean }) {
  const t = useT("campaign");
  const r = 46;
  const label = t("quest.clockLabel", { label: clock.label || t("quest.clock"), filled: clock.filled, segments: clock.segments });
  const full = clock.filled >= clock.segments;
  return (
    <svg className={full ? "qs-clock full" : "qs-clock"} width={size} height={size} viewBox="-50 -50 100 100" role={onSet ? "group" : "img"} aria-label={label}>
      <circle r={r} className="qs-clock-face" />
      {Array.from({ length: clock.segments }, (_, i) => {
        const filled = i < clock.filled;
        const path = <path d={wedge(i, clock.segments, r)} className={filled ? "qs-clock-seg filled" : "qs-clock-seg"} />;
        if (!onSet) return <g key={i}>{path}</g>;
        const next = clock.filled === i + 1 ? i : i + 1;
        return (
          <g
            key={i}
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-label={t("quest.clockSetTo", { n: next, segments: clock.segments })}
            aria-disabled={disabled}
            className="qs-clock-hit"
            onClick={() => !disabled && onSet(next)}
            onKeyDown={(e) => {
              if (disabled || (e.key !== "Enter" && e.key !== " ")) return;
              e.preventDefault();
              onSet(next);
            }}
          >
            {path}
          </g>
        );
      })}
    </svg>
  );
}
