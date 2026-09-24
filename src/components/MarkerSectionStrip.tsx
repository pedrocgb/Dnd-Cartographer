"use client";

import { Book, Info, Crown, Link as LinkIcon } from "lucide-react";
import type { MarkerSection } from "./MarkerPanel";

const SECTIONS: { key: MarkerSection; label: string; Icon: typeof Info }[] = [
  { key: "basic", label: "Basic Information", Icon: Info },
  { key: "politics", label: "Political References", Icon: Crown },
  { key: "articles", label: "Articles", Icon: Book },
  { key: "links", label: "Links", Icon: LinkIcon },
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
  return (
    <div className="marker-section-strip" role="tablist" aria-label="Marker sections">
      {SECTIONS.map(({ key, label, Icon }) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={section === key}
          aria-label={label}
          title={label}
          className={section === key ? "marker-section-strip-btn active" : "marker-section-strip-btn"}
          onClick={() => onChange(key)}
        >
          <Icon size={17} strokeWidth={2.25} />
        </button>
      ))}
    </div>
  );
}
