"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { useT } from "@/i18n/useT";

/** A labelled slider with a typed value and a reset to its default: the map tools' number setting. */
export function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  defaultValue,
  suffix,
  mixed = false,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  defaultValue: number;
  suffix?: string;
  /** The edited items have different values: shown as "Mixed" until one is set. */
  mixed?: boolean;
  onChange: (value: number) => void;
}) {
  const tc = useT("common");
  // Round to 2 decimals (not a fixed 1) so small values like 0.05 remain
  // visible instead of collapsing to "0.1"/"0.0" — trailing zeros are
  // naturally dropped by the Number->String conversion.
  const formatValue = (v: number) => (Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100));
  const [text, setText] = useState(() => formatValue(value));
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) setText(formatValue(value));
  }, [value]);

  function commit(raw: string) {
    const parsed = Number(raw);
    if (raw.trim() === "" || Number.isNaN(parsed)) {
      setText(formatValue(value));
      return;
    }
    const clamped = Math.min(max, Math.max(min, parsed));
    onChange(clamped);
    setText(formatValue(clamped));
  }

  // Still showing the first item's value: nothing set yet.
  const showMixed = mixed && text === formatValue(value);

  return (
    <div className={showMixed ? "grid-field mixed" : "grid-field"}>
      <div className="grid-field-header">
        <span className="field-label">{label}</span>
        <button
          className="btn btn-ghost btn-icon-xs"
          onClick={() => onChange(defaultValue)}
          aria-label={tc("slider.reset", { label })}
          data-tooltip={tc("slider.reset", { label })}
        >
          <RotateCcw size={12} strokeWidth={2.25} />
        </button>
        <span className="grid-field-value">
          <input
            type="number"
            className="grid-field-value-input"
            value={showMixed ? "" : text}
            placeholder={showMixed ? tc("color.mixed") : undefined}
            min={min}
            max={max}
            step={step}
            aria-label={tc("slider.value", { label })}
            onFocus={() => {
              focusedRef.current = true;
            }}
            onChange={(e) => setText(e.target.value)}
            onBlur={(e) => {
              focusedRef.current = false;
              commit(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
          />
          {suffix ?? ""}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
