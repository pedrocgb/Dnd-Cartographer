"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minus, X } from "lucide-react";

/** Open, not minimized modals, oldest first. */
const openModals: object[] = [];

/** A modal owns the keyboard (Esc closes it): page-level shortcuts stand down while one is open. */
export function isModalOpen(): boolean {
  return openModals.length > 0;
}

/** Registers an open overlay as a modal: Esc closes it when it's the topmost one, and page shortcuts stand down. */
export function useModalKeyboard(active: boolean, onClose: () => void) {
  const token = useRef({});
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  // Esc closes only the topmost open modal (a confirm opened over a dialog).
  useEffect(() => {
    if (!active) return;
    const own = token.current;
    openModals.push(own);
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape" || openModals[openModals.length - 1] !== own) return;
      e.preventDefault();
      closeRef.current();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      openModals.splice(openModals.indexOf(own), 1);
    };
  }, [active]);
}

export default function Modal({
  open,
  onClose,
  title,
  size = "normal",
  minimized = false,
  onMinimize,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** "wide" for content grids (e.g. the article template chooser). */
  size?: "normal" | "wide";
  /** Shown as a small bar at the bottom of the screen instead (see onMinimize). */
  minimized?: boolean;
  /** Adds a minimize button; called with true to minimize, false to restore. */
  onMinimize?: (minimized: boolean) => void;
  /** Extra class on the backdrop (e.g. to mark it as part of the editor's floating UI). */
  className?: string;
  children: React.ReactNode;
}) {
  useModalKeyboard(open && !minimized, onClose);

  if (!open) return null;

  if (minimized && onMinimize) {
    return createPortal(
      <div className="modal-dock" role="dialog" aria-label={`${title} (minimized)`}>
        <span className="modal-dock-title">{title}</span>
        <button className="btn btn-sm" onClick={() => onMinimize(false)} autoFocus>
          <Maximize2 size={14} strokeWidth={2.25} />
          Restore
        </button>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close dialog" data-tooltip="Close">
          <X size={14} strokeWidth={2.25} />
        </button>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div
      className={className ? `modal-backdrop ${className}` : "modal-backdrop"}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={size === "wide" ? "modal-card modal-card-wide" : "modal-card"} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-header">
          <h2>{title}</h2>
          <div className="modal-header-actions">
            {onMinimize && (
              <button className="btn btn-ghost btn-icon" onClick={() => onMinimize(true)} aria-label="Minimize dialog" data-tooltip="Minimize to see the page behind">
                <Minus size={16} strokeWidth={2.25} />
              </button>
            )}
            <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close dialog">
              <X size={16} strokeWidth={2.25} />
            </button>
          </div>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body
  );
}
