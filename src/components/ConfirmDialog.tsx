"use client";

import { TriangleAlert } from "lucide-react";
import Modal from "./Modal";

/**
 * The app's confirmation dialog (instead of window.confirm): a warning,
 * Cancel focused by default so Enter never destroys anything by accident,
 * and the confirm button naming exactly what happens. Esc, the ✕ and a
 * backdrop click cancel. `error` shows a failure inline and keeps it open.
 */
export default function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  busyLabel,
  danger = true,
  busy = false,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  /** The warning: what will happen and what it affects. */
  children: React.ReactNode;
  confirmLabel: string;
  busyLabel?: string;
  danger?: boolean;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal open={open} onClose={() => !busy && onCancel()} title={title}>
      <div className={danger ? "confirm-dialog danger" : "confirm-dialog"}>
        <span className="confirm-dialog-icon" aria-hidden>
          <TriangleAlert size={20} strokeWidth={2.25} />
        </span>
        <div className="confirm-dialog-text">{children}</div>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="confirm-dialog-actions">
        <button type="button" className="btn btn-sm" onClick={onCancel} disabled={busy} autoFocus>
          Cancel
        </button>
        <button type="button" className={danger ? "btn btn-sm btn-danger" : "btn btn-sm btn-primary"} onClick={onConfirm} disabled={busy}>
          {busy ? (busyLabel ?? confirmLabel) : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
