"use client";

import { useEffect, useRef, useState } from "react";
import { autoUpdate, computePosition, flip, offset, shift } from "@floating-ui/dom";

/** Gap kept between the popup and the window edges. */
const VIEWPORT_PADDING = 8;

/**
 * Open state and refs for a popup portaled to <body> and anchored to its
 * trigger button with floating-ui (fixed; flips above when there's no room
 * below). Esc or a click outside closes it; Esc is caught in the capture
 * phase so it closes only the popup, not a modal around it. The popup should
 * render hidden (`visibility: hidden`); it's revealed once positioned.
 */
export function usePopover<T extends HTMLElement = HTMLButtonElement>() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);
  const trigger = useRef<T | null>(null);
  const pop = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!root.current?.contains(target) && !pop.current?.contains(target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  useEffect(() => {
    const anchor = trigger.current;
    const floating = pop.current;
    if (!open || !anchor || !floating) return;
    return autoUpdate(anchor, floating, () => {
      void computePosition(anchor, floating, {
        strategy: "fixed",
        placement: "bottom-start",
        middleware: [offset(6), flip({ padding: VIEWPORT_PADDING }), shift({ padding: VIEWPORT_PADDING })],
      }).then(({ x, y }) => Object.assign(floating.style, { left: `${x}px`, top: `${y}px`, visibility: "visible" }));
    });
  }, [open]);

  return { open, setOpen, root, trigger, pop };
}
