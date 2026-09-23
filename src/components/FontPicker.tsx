"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { MAP_FONTS, mapFontFamily, type MapFontKey } from "@/server/texts/fonts";

/**
 * Font dropdown where every option is drawn in its own font. A native
 * <select> can't do this reliably (Chrome ignores font-family on <option>
 * on Windows), so this is a small listbox following the ARIA
 * select-only combobox pattern: ↑/↓/Home/End move, Enter/Space picks,
 * Esc closes, typing a letter jumps to the next font starting with it.
 */
export default function FontPicker({
  value,
  bold,
  onChange,
}: {
  value: MapFontKey;
  bold: boolean;
  onChange: (key: MapFontKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, MAP_FONTS.findIndex((f) => f.key === value)));
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const listId = useId();
  const current = MAP_FONTS.find((f) => f.key === value) ?? MAP_FONTS[0];
  const fontWeight = bold ? 700 : 400;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.children[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  function openList() {
    setActiveIndex(Math.max(0, MAP_FONTS.findIndex((f) => f.key === value)));
    setOpen(true);
  }

  function pick(index: number) {
    onChange(MAP_FONTS[index].key);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const last = MAP_FONTS.length - 1;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }
    if (e.key === "ArrowDown") setActiveIndex((i) => Math.min(last, i + 1));
    else if (e.key === "ArrowUp") setActiveIndex((i) => Math.max(0, i - 1));
    else if (e.key === "Home") setActiveIndex(0);
    else if (e.key === "End") setActiveIndex(last);
    else if (e.key === "Enter" || e.key === " ") pick(activeIndex);
    else if (e.key === "Escape" || e.key === "Tab") {
      setOpen(false);
      if (e.key === "Tab") return;
    } else if (e.key.length === 1 && /\S/.test(e.key)) {
      const ch = e.key.toLowerCase();
      const order = [...MAP_FONTS.keys()].map((k) => (activeIndex + 1 + k) % MAP_FONTS.length);
      const hit = order.find((i) => MAP_FONTS[i].label.toLowerCase().startsWith(ch));
      if (hit !== undefined) setActiveIndex(hit);
    } else return;
    e.preventDefault();
  }

  return (
    <div className="font-picker" ref={rootRef}>
      <button
        type="button"
        className="font-picker-button"
        role="combobox"
        aria-label="Font"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${activeIndex}` : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
      >
        <span style={{ fontFamily: mapFontFamily(current.key), fontWeight }}>{current.label}</span>
        <ChevronDown size={14} strokeWidth={2.25} aria-hidden />
      </button>
      {open && (
        <ul className="font-picker-list" role="listbox" id={listId} ref={listRef} aria-label="Font">
          {MAP_FONTS.map((f, i) => (
            <li
              key={f.key}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={f.key === value}
              className={i === activeIndex ? "font-picker-option active" : "font-picker-option"}
              style={{ fontFamily: mapFontFamily(f.key), fontWeight }}
              onMouseEnter={() => setActiveIndex(i)}
              // mousedown, not click: keeps focus on the button (no blur flicker)
              onMouseDown={(e) => {
                e.preventDefault();
                pick(i);
              }}
            >
              {f.label}
              {f.key === value && <Check size={13} strokeWidth={2.5} aria-hidden />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
