"use client";

import { useId, useState } from "react";
import { ChevronRight } from "lucide-react";

/**
 * A marker panel card: a header with an arrow that collapses/expands it,
 * the same for every card in the panel (Main article, Description,
 * Appearance, Details). Cards start collapsed unless `defaultOpen`.
 *
 * The body is always mounted and merely hidden when collapsed (never
 * conditionally rendered) — conditionally rendering it would unmount and
 * remount its children (e.g. Description's RichEditor) every time the card
 * toggles, which for a stateful child means: a fresh mount refetches from
 * scratch, briefly shows empty content, and can race with autosave into
 * overwriting real data with that empty draft. Confirmed as a real,
 * reported bug — not a theoretical concern.
 *
 * `bare` drops the header and card chrome and pins the body open (view
 * mode's Description), while keeping the same element in the same place,
 * so switching modes never remounts the body.
 */
export default function MarkerCard({
  title,
  defaultOpen = false,
  bare = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  bare?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  const isOpen = bare || open;

  return (
    <section className={bare ? "marker-card marker-card-bare" : "marker-card"} aria-label={title}>
      {!bare && (
        <button type="button" className="marker-card-toggle" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen((o) => !o)}>
          <ChevronRight size={14} strokeWidth={2.25} className={open ? "marker-collapsible-chevron open" : "marker-collapsible-chevron"} />
          <span className="marker-card-title">{title}</span>
        </button>
      )}
      <div id={bodyId} className="marker-card-body" hidden={!isOpen}>
        {children}
      </div>
    </section>
  );
}
