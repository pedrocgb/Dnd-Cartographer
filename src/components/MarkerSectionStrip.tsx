"use client";

import { Book, Info, Crown, Link as LinkIcon } from "lucide-react";
import type { MarkerSection } from "./MarkerPanel";
import { useT } from "@/i18n/useT";

const SECTIONS: { key: MarkerSection; Icon: typeof Info }[] = [
  { key: "basic", Icon: Info },
  { key: "politics", Icon: Crown },
  { key: "articles", Icon: Book },
  { key: "links", Icon: LinkIcon },
];

/**
 * Anchored outside and above the marker panel's top-right edge (a sibling
 * in `.viewer-canvas-area`, not an internal tab strip) — see
 * `.marker-section-strip` in globals.css, which positions it at
 * `left: 320px` (the panel's own fixed width) so it tracks the panel
 * without needing to measure it at runtime.
 */
export default function MarkerSectionStrip({
  section,
  onChange,
}: {
  section: MarkerSection;
  onChange: (section: MarkerSection) => void;
}) {
  const tm = useT("maps");
  return (
    <div className="marker-section-strip" role="tablist" aria-label={tm("markerPanel.sections")}>
      {SECTIONS.map(({ key, Icon }) => {
        const label = tm(`markerPanel.section.${key}`);
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={section === key}
            aria-label={label}
            data-tooltip={label}
            className={section === key ? "marker-section-strip-btn active" : "marker-section-strip-btn"}
            onClick={() => onChange(key)}
          >
            <Icon size={17} strokeWidth={2.25} />
          </button>
        );
      })}
    </div>
  );
}
