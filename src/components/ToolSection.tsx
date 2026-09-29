"use client";

import { useId, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

const STORAGE_KEY = "map-tool-sections";

function readOpen(): Record<string, boolean> {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") ?? {};
  } catch {
    return {};
  }
}

function saveOpen(id: string, open: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readOpen(), [id]: open }));
  } catch {
    // Storage unavailable: the section just won't remember.
  }
}

/**
 * A titled group of settings in a map tool panel (Color, Shadow, Layers, …)
 * that folds away behind a small arrow. Each section remembers whether it
 * was open, per `id`, across panels and visits.
 */
export default function ToolSection({ id, title, defaultOpen = true, children }: { id: string; title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(() => (typeof window === "undefined" ? defaultOpen : (readOpen()[id] ?? defaultOpen)));
  const bodyId = useId();
  return (
    <section className={open ? "tool-section open" : "tool-section"}>
      <button
        type="button"
        className="tool-section-head"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => {
          setOpen(!open);
          saveOpen(id, !open);
        }}
      >
        {open ? <ChevronDown size={13} strokeWidth={2.25} aria-hidden /> : <ChevronRight size={13} strokeWidth={2.25} aria-hidden />}
        {title}
      </button>
      {open && (
        <div id={bodyId} className="tool-section-body">
          {children}
        </div>
      )}
    </section>
  );
}
