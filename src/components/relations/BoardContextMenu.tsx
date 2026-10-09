"use client";

import { useEffect, useRef } from "react";
import type { LucideIcon } from "lucide-react";

export interface MenuAction {
  key: string;
  label: string;
  Icon: LucideIcon;
  onSelect: () => void;
  disabled?: boolean;
  danger?: boolean;
}

/**
 * A right-click menu at the pointer: closes on a click elsewhere, Esc,
 * scrolling (zoom) or after an action. The first item takes focus.
 */
export default function BoardContextMenu({ x, y, label, actions, onClose }: { x: number; y: number; label: string; actions: MenuAction[]; onClose: () => void }) {
  const ref = useRef<HTMLUListElement>(null);

  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", onClose);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", onClose);
    };
  }, [onClose]);

  return (
    <ul
      ref={ref}
      className="rel-context-menu"
      role="menu"
      aria-label={label}
      style={{ left: x, top: y }}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
        e.preventDefault();
        const items = [...(ref.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])];
        const at = items.indexOf(document.activeElement as HTMLButtonElement);
        items[(at + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
      }}
    >
      {actions.map(({ key, label: itemLabel, Icon, onSelect, disabled, danger }) => (
        <li key={key} role="none">
          <button
            type="button"
            role="menuitem"
            className={danger ? "rel-context-item danger" : "rel-context-item"}
            disabled={disabled}
            onClick={() => {
              onClose();
              onSelect();
            }}
          >
            <Icon size={14} aria-hidden />
            {itemLabel}
          </button>
        </li>
      ))}
    </ul>
  );
}
