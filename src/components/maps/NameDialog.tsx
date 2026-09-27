"use client";

import { useState } from "react";
import Modal from "@/components/Modal";

/** A one-field name dialog: create a folder, rename a folder or a map. `onSave` resolves an error message, or null when done. */
export default function NameDialog({
  title,
  label,
  initialName = "",
  saveLabel,
  maxLength,
  onSave,
  onCancel,
}: {
  title: string;
  label: string;
  initialName?: string;
  saveLabel: string;
  maxLength: number;
  onSave: (name: string) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = name.trim();

  async function submit() {
    if (!trimmed || busy) return;
    if (trimmed === initialName) return onCancel();
    setBusy(true);
    setError(null);
    const problem = await onSave(trimmed).catch(() => "Could not reach the server. Try again.");
    setBusy(false);
    if (problem) setError(problem);
  }

  return (
    <Modal open onClose={() => !busy && onCancel()} title={title}>
      <form
        className="new-map-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label className="field-label" htmlFor="name-dialog-input">
          {label}
        </label>
        <input
          id="name-dialog-input"
          type="text"
          value={name}
          maxLength={maxLength}
          autoFocus
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setName(e.target.value)}
        />
        {error && <p className="form-error">{error}</p>}
        <div className="confirm-dialog-actions">
          <button type="button" className="btn btn-sm" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-sm btn-primary" disabled={busy || !trimmed}>
            {busy ? "Saving…" : saveLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
