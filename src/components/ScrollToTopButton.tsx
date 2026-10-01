"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

const SIZE = 40;
/** Space between the content's edge and the button, and from the pane's edges. */
const GAP = 16;

type Position = { left: number; top: number };

/**
 * Where the button sits: just past the right edge of the container's
 * content (a centered page), or in the container's corner when there's no
 * room beside it. Screen coordinates, for position: fixed.
 */
function placement(container: HTMLElement): Position {
  const pane = container.getBoundingClientRect();
  const scrollbar = container.offsetWidth - container.clientWidth;
  const corner = pane.right - scrollbar - SIZE - GAP;
  const content = container.firstElementChild?.getBoundingClientRect();
  return { left: Math.min(content ? content.right + GAP : corner, corner), top: pane.bottom - SIZE - GAP };
}

/**
 * A floating "back to top" button for a scrolling container: shown only
 * while the container has more content than fits (it has a scrollbar),
 * fixed on screen beside the content so it stays put while scrolling.
 */
export default function ScrollToTopButton({ container }: { container: HTMLElement | null }) {
  const [scrollable, setScrollable] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);

  useEffect(() => {
    if (!container) return;
    const check = () => {
      setScrollable(container.scrollHeight > container.clientHeight + 1);
      const next = placement(container);
      setPosition((prev) => (prev && prev.left === next.left && prev.top === next.top ? prev : next));
    };
    check();
    // The pane resizes with the window, and its page (first child) with every article.
    const resize = new ResizeObserver(check);
    resize.observe(container);
    if (container.firstElementChild) resize.observe(container.firstElementChild);
    // Content changes with every article and edit (a new page element included).
    const content = new MutationObserver(() => {
      if (container.firstElementChild) resize.observe(container.firstElementChild);
      check();
    });
    content.observe(container, { childList: true, subtree: true });
    // Images and fonts settle a moment after the DOM does; the window moving the pane needn't resize it.
    container.addEventListener("load", check, true);
    window.addEventListener("resize", check);
    return () => {
      resize.disconnect();
      content.disconnect();
      container.removeEventListener("load", check, true);
      window.removeEventListener("resize", check);
    };
  }, [container]);

  if (!scrollable || !container || !position) return null;
  return (
    <button
      type="button"
      className="scroll-to-top"
      style={position}
      aria-label="Back to top"
      data-tooltip="Back to top"
      onClick={() => {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        container.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
      }}
    >
      <ArrowUp size={18} strokeWidth={2.25} />
    </button>
  );
}
