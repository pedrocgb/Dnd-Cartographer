"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { autoUpdate, computePosition, flip, offset, shift } from "@floating-ui/dom";

/** Hover wait before the first tooltip; once one is showing, the next appears at once. */
const SHOW_DELAY_MS = 350;
const WARM_MS = 300;
const VIEWPORT_PADDING = 8;
const BUBBLE_ID = "app-tooltip";

const tipOf = (el: Element | null) => el?.closest<HTMLElement | SVGElement>("[data-tooltip]") ?? null;

/**
 * The app's one hover-text system, mounted once in the root layout. Any
 * element with `data-tooltip="…"` gets a styled bubble on hover or keyboard
 * focus (instead of the browser's native `title` box). The bubble floats
 * over everything (portaled, floating-ui), flips to stay on screen, hides
 * on click, scroll or Esc, and is linked to its element with
 * `aria-describedby` while shown. An empty value shows nothing.
 */
export default function TooltipLayer() {
  const [tip, setTip] = useState<{ target: HTMLElement | SVGElement; text: string } | null>(null);
  const bubble = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let timer: number | undefined;
    let current: HTMLElement | SVGElement | null = null;
    let warmUntil = 0;

    const show = (target: HTMLElement | SVGElement) => {
      const text = target.getAttribute("data-tooltip")?.trim();
      if (!text) return;
      current = target;
      setTip({ target, text });
    };
    const hide = () => {
      window.clearTimeout(timer);
      if (current) warmUntil = Date.now() + WARM_MS;
      current = null;
      setTip(null);
    };
    const schedule = (target: HTMLElement | SVGElement) => {
      window.clearTimeout(timer);
      if (Date.now() < warmUntil || current) show(target);
      else timer = window.setTimeout(() => show(target), SHOW_DELAY_MS);
    };

    const onOver = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const target = tipOf(e.target as Element);
      if (target === current) return;
      if (!target) return hide();
      schedule(target);
    };
    const onOut = (e: PointerEvent) => {
      const target = tipOf(e.target as Element);
      if (target && !target.contains(e.relatedTarget as Node | null) && tipOf(e.relatedTarget as Element | null) !== target) hide();
    };
    const onFocus = (e: FocusEvent) => {
      const target = tipOf(e.target as Element);
      if (target && (e.target as Element).matches(":focus-visible")) show(target);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && current && hide();

    document.addEventListener("pointerover", onOver);
    document.addEventListener("pointerout", onOut);
    document.addEventListener("pointerdown", hide, true);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", hide);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", hide, true);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("pointerdown", hide, true);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", hide);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", hide, true);
    };
  }, []);

  // Position against the element, link it for screen readers, and follow text changes (e.g. "Undo: …").
  useEffect(() => {
    const floating = bubble.current;
    if (!tip || !floating) return;
    const { target } = tip;
    const describedBy = target.getAttribute("aria-describedby");
    target.setAttribute("aria-describedby", describedBy ? `${describedBy} ${BUBBLE_ID}` : BUBBLE_ID);
    const watcher = new MutationObserver(() => {
      const text = target.getAttribute("data-tooltip")?.trim();
      if (!text || !target.isConnected) setTip(null);
      else if (text !== tip.text) setTip({ target, text });
    });
    watcher.observe(target, { attributes: true, attributeFilter: ["data-tooltip"] });
    const stop = autoUpdate(target, floating, () => {
      if (!target.isConnected) return setTip(null);
      void computePosition(target, floating, {
        strategy: "fixed",
        placement: "top",
        middleware: [offset(6), flip({ padding: VIEWPORT_PADDING }), shift({ padding: VIEWPORT_PADDING })],
      }).then(({ x, y }) => Object.assign(floating.style, { left: `${x}px`, top: `${y}px`, visibility: "visible" }));
    });
    return () => {
      stop();
      watcher.disconnect();
      if (describedBy) target.setAttribute("aria-describedby", describedBy);
      else target.removeAttribute("aria-describedby");
    };
  }, [tip]);

  if (!tip) return null;
  return createPortal(
    // Hidden until positioned, so it never flashes at the corner.
    <div ref={bubble} id={BUBBLE_ID} role="tooltip" className="app-tooltip" style={{ visibility: "hidden" }}>
      {tip.text}
    </div>,
    document.body
  );
}
