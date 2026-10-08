"use client";

import { ArrowUp, PenLine } from "lucide-react";
import { scrollToTop, useFloatingInPane, type Position } from "@/components/ScrollToTopButton";
import { useT } from "@/i18n/useT";

const SIZE = 40;
const GAP = 16;

/**
 * Just past the right edge of the story's text, at the pane's bottom (the
 * dock grows upward from there), or in the pane's corner when there's no
 * room beside the text. Screen coordinates.
 */
const besideText = (pane: HTMLElement): Position => {
  const rect = pane.getBoundingClientRect();
  const scrollbar = pane.offsetWidth - pane.clientWidth;
  const corner = rect.right - scrollbar - SIZE - GAP;
  const text = pane.querySelector(".wr-reader")?.getBoundingClientRect();
  return { left: Math.min(text ? text.right + GAP : corner, corner), top: rect.bottom - GAP };
};

/**
 * Read mode's floating controls beside the story's text, at the bottom of
 * the pane: back to top (only while the story scrolls) above Edit.
 */
export default function ReaderDock({ pane, onEdit }: { pane: HTMLElement | null; onEdit: () => void }) {
  const t = useT("writer");
  const { scrollable, position } = useFloatingInPane(pane, besideText);
  if (!pane || !position) return null;
  return (
    <div className="wr-reader-dock" style={position}>
      {scrollable && (
        <button type="button" className="scroll-to-top" aria-label={t("reader.backToTop")} data-tooltip={t("reader.backToTop")} onClick={() => scrollToTop(pane)}>
          <ArrowUp size={18} strokeWidth={2.25} />
        </button>
      )}
      <button type="button" className="scroll-to-top" aria-label={t("ui.edit")} data-tooltip={t("ui.edit")} onClick={onEdit}>
        <PenLine size={18} strokeWidth={2.25} />
      </button>
    </div>
  );
}
