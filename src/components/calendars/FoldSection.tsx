"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

/** A section of the day panel that folds open/closed from its header; `action` sits at the header's right. */
export default function FoldSection({ title, count, action, children }: { title: string; count?: number; action?: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="cal-details-section">
      <div className="day-fold-head">
        <button type="button" className="day-fold-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
          <h3 className="field-label">{title}</h3>
          {count ? <span className="day-fold-count">{count}</span> : null}
        </button>
        {action}
      </div>
      {open && children}
    </section>
  );
}
