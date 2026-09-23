"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { sortLayers, type AlwaysDrawFlag, type MapLayerData } from "./layer-images";

/** Past this many layers the dropdown gets a filter box. */
const FILTER_THRESHOLD = 6;

/**
 * "Also show on": the other layers an item is drawn (and editable) on besides
 * its home layer, as a dropdown so it stays compact with many layers. It is
 * a disclosure button over native checkboxes in a labelled group (rather than
 * an ARIA listbox), so keyboard and screen-reader behavior come for free:
 * Tab moves through the options, Space toggles, Esc closes.
 */
export default function LayerChecklist({
  layers,
  homeLayerId,
  value,
  alwaysDrawFlag,
  onChange,
}: {
  layers: MapLayerData[];
  homeLayerId: string | null;
  value: readonly string[];
  alwaysDrawFlag: AlwaysDrawFlag;
  onChange: (extraLayerIds: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const labelId = useId();
  const popupId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const others = sortLayers(layers).filter((l) => l.id !== homeLayerId);
  if (others.length === 0) return null;
  const home = layers.find((l) => l.id === homeLayerId);
  // Drawn everywhere already: its home layer draws this kind on every layer.
  const homeAlwaysDraws = Boolean(home?.[alwaysDrawFlag]);
  const chosen = others.filter((l) => value.includes(l.id));
  const summary = homeAlwaysDraws
    ? "Every layer (Always draw is on)"
    : chosen.length === 0
      ? "None"
      : chosen.length <= 2
        ? chosen.map((l) => l.name).join(", ")
        : `${chosen.length} layers`;
  const q = query.trim().toLowerCase();
  const shown = q ? others.filter((l) => l.name.toLowerCase().includes(q)) : others;

  function toggle(id: string, on: boolean) {
    onChange(on ? [...value.filter((v) => v !== id), id] : value.filter((v) => v !== id));
  }

  function close() {
    setOpen(false);
    setQuery("");
    triggerRef.current?.focus();
  }

  return (
    <div
      className="layer-multi"
      ref={rootRef}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          close();
        }
      }}
    >
      <span id={labelId} className="field-label">
        Also show on
      </span>
      <button
        ref={triggerRef}
        type="button"
        className="layer-multi-trigger"
        disabled={homeAlwaysDraws}
        aria-expanded={open}
        aria-controls={popupId}
        aria-labelledby={`${labelId} ${popupId}-summary`}
        title={homeAlwaysDraws ? "Its layer has “Always draw” on, so it already shows on every layer." : chosen.map((l) => l.name).join(", ") || undefined}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <span id={`${popupId}-summary`} className={chosen.length ? "layer-multi-summary" : "layer-multi-summary muted"}>
          {summary}
        </span>
        <ChevronDown size={14} strokeWidth={2.25} aria-hidden />
      </button>

      {open && (
        <div id={popupId} className="layer-multi-popup">
          {others.length > FILTER_THRESHOLD && (
            <input
              type="search"
              className="layer-multi-filter"
              placeholder="Filter layers"
              aria-label="Filter layers"
              value={query}
              autoFocus
              onChange={(e) => setQuery(e.target.value)}
            />
          )}
          <div className="layer-multi-actions">
            <button type="button" className="layer-multi-action" onClick={() => onChange(others.map((l) => l.id))}>
              All
            </button>
            <button type="button" className="layer-multi-action" onClick={() => onChange([])}>
              None
            </button>
          </div>
          <div role="group" aria-labelledby={labelId} className="layer-multi-options">
            {shown.map((l) => (
              <label key={l.id} className="layer-checkbox layer-multi-option">
                <input type="checkbox" checked={value.includes(l.id)} onChange={(e) => toggle(l.id, e.target.checked)} />
                <span>
                  {l.name}
                  {!l.visible && <span className="field-label"> (hidden)</span>}
                </span>
              </label>
            ))}
            {shown.length === 0 && <p className="field-label layer-multi-empty">No layer matches.</p>}
          </div>
          {home && <p className="field-label layer-multi-home">Always on: {home.name}</p>}
        </div>
      )}
    </div>
  );
}
