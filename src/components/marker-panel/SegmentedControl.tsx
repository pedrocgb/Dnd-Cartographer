"use client";

import { useRef } from "react";

export interface Segment<K extends string> {
  key: K;
  label: string;
  /** Replaces the text label; `label` then becomes its tooltip and accessible name. */
  icon?: React.ReactNode;
  disabled?: boolean;
}

/**
 * A row of mutually exclusive options (a radio group styled as joined
 * buttons) — for short choice lists, instead of a dropdown. ←/→ move the
 * choice, like a native radio group.
 */
export default function SegmentedControl<K extends string>({
  segments,
  value,
  ariaLabel,
  onChange,
}: {
  segments: readonly Segment<K>[];
  value: K;
  ariaLabel: string;
  onChange: (key: K) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const enabled = segments.filter((s) => !s.disabled);
    const at = enabled.findIndex((s) => s.key === value);
    const next = enabled[(at + (e.key === "ArrowRight" ? 1 : -1) + enabled.length) % enabled.length];
    if (!next) return;
    onChange(next.key);
    rootRef.current?.querySelector<HTMLButtonElement>(`[data-key="${next.key}"]`)?.focus();
  }

  return (
    <div ref={rootRef} className="segmented" role="radiogroup" aria-label={ariaLabel} onKeyDown={onKeyDown}>
      {segments.map((s) => {
        const checked = s.key === value;
        return (
          <button
            key={s.key}
            type="button"
            role="radio"
            data-key={s.key}
            aria-checked={checked}
            aria-label={s.icon ? s.label : undefined}
            data-tooltip={s.icon ? s.label : undefined}
            tabIndex={checked ? 0 : -1}
            disabled={s.disabled}
            className={checked ? "segmented-option active" : "segmented-option"}
            onClick={() => onChange(s.key)}
          >
            {s.icon ?? s.label}
          </button>
        );
      })}
    </div>
  );
}
