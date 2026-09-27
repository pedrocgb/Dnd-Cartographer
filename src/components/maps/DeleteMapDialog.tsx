"use client";

import { useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";

/**
 * The app's delete-map confirmation (maps list and inside a map). The map
 * goes to the Trash (restorable); a map with child maps asks what happens
 * to them: back to the root (default) or to the Trash with it.
 */
export default function DeleteMapDialog({
  map,
  childCount,
  onDeleted,
  onCancel,
}: {
  map: { id: string; name: string };
  childCount: number;
  onDeleted: () => void;
  onCancel: () => void;
}) {
  const [strategy, setStrategy] = useState<"orphan" | "cascade">("orphan");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/maps/${map.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(childCount > 0 ? { strategy } : {}),
      });
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error ?? "Could not delete the map.");
        return;
      }
      onDeleted();
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConfirmDialog
      open
      title={`Delete "${map.name}"?`}
      confirmLabel="Delete map"
      busyLabel="Deleting…"
      busy={busy}
      error={error}
      onConfirm={remove}
      onCancel={onCancel}
    >
      <p>The map moves to the Trash together with its layers, markers, zones, texts and lines.</p>
      {childCount > 0 && (
        <fieldset className="confirm-dialog-choice">
          <legend>
            It has {childCount} child map{childCount === 1 ? "" : "s"}:
          </legend>
          <label>
            <input type="radio" name="child-maps" checked={strategy === "orphan"} onChange={() => setStrategy("orphan")} />
            Keep them, moved to the root
          </label>
          <label>
            <input type="radio" name="child-maps" checked={strategy === "cascade"} onChange={() => setStrategy("cascade")} />
            Move them (and their own children) to the Trash too
          </label>
        </fieldset>
      )}
      <ul>
        <li>You can restore it from the Trash page.</li>
      </ul>
    </ConfirmDialog>
  );
}
