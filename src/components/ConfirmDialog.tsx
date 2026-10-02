"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import Modal from "./Modal";

/**
 * The app's confirmation dialog (instead of window.confirm): a warning,
 * Cancel focused by default so Enter never destroys anything by accident,
 * and the confirm button naming exactly what happens. Esc, the ✕ and a
 * backdrop click cancel. `error` shows a failure inline and keeps it open.
 * `confirmText` (e.g. a world's name) must be typed before confirming.
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
  confirmText,
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
  /** When set, the confirm button stays disabled until this exact text is typed. */
  confirmText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal open={open} onClose={() => !busy && onCancel()} title={title}>
      <ConfirmBody danger={danger} busy={busy} error={error} confirmLabel={confirmLabel} busyLabel={busyLabel} confirmText={confirmText} onConfirm={onConfirm} onCancel={onCancel}>
        {children}
      </ConfirmBody>
    </Modal>
  );
}

/** The dialog's content: mounted on each open, so the typed confirmation starts empty every time. */
function ConfirmBody({
  danger,
  busy,
  error,
  confirmLabel,
  busyLabel,
  confirmText,
  onConfirm,
  onCancel,
  children,
}: {
  danger: boolean;
  busy: boolean;
  error?: string | null;
  confirmLabel: string;
  busyLabel?: string;
  confirmText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  children: React.ReactNode;
}) {
  const [typed, setTyped] = useState("");
  const blocked = confirmText !== undefined && typed !== confirmText;
  return (
    <>
      <div className={danger ? "confirm-dialog danger" : "confirm-dialog"}>
        <span className="confirm-dialog-icon" aria-hidden>
          <TriangleAlert size={20} strokeWidth={2.25} />
        </span>
        <div className="confirm-dialog-text">{children}</div>
      </div>
      {confirmText !== undefined && (
        <label className="confirm-dialog-type">
          <span>
            Type <strong>{confirmText}</strong> to confirm
          </span>
          <input type="text" value={typed} autoComplete="off" spellCheck={false} onChange={(e) => setTyped(e.target.value)} />
        </label>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="confirm-dialog-actions">
        <button type="button" className="btn btn-sm" onClick={onCancel} disabled={busy} autoFocus>
          Cancel
        </button>
        <button type="button" className={danger ? "btn btn-sm btn-danger" : "btn btn-sm btn-primary"} onClick={onConfirm} disabled={busy || blocked}>
          {busy ? (busyLabel ?? confirmLabel) : confirmLabel}
        </button>
      </div>
    </>
  );
}
