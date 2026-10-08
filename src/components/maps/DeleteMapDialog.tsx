"use client";

import { useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useT } from "@/i18n/useT";
import { formatInteger } from "@/server/settings/number-format";

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
  const t = useT("maps");
  const tc = useT("common");
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
        setError((await res.json().catch(() => ({}))).error ?? t("deleteMap.failed"));
        return;
      }
      onDeleted();
    } catch {
      setError(tc("serverUnreachable"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConfirmDialog
      open
      title={t("deleteMap.title", { name: map.name })}
      confirmLabel={t("deleteMap.confirm")}
      busyLabel={tc("deleting")}
      busy={busy}
      error={error}
      onConfirm={remove}
      onCancel={onCancel}
    >
      <p>{t("deleteMap.body")}</p>
      {childCount > 0 && (
        <fieldset className="confirm-dialog-choice">
          <legend>{t("deleteMap.children", { count: childCount, n: formatInteger(childCount) })}</legend>
          <label>
            <input type="radio" name="child-maps" checked={strategy === "orphan"} onChange={() => setStrategy("orphan")} />
            {t("deleteMap.keepChildren")}
          </label>
          <label>
            <input type="radio" name="child-maps" checked={strategy === "cascade"} onChange={() => setStrategy("cascade")} />
            {t("deleteMap.cascadeChildren")}
          </label>
        </fieldset>
      )}
      <ul>
        <li>{t("deleteMap.restoreHint")}</li>
      </ul>
    </ConfirmDialog>
  );
}
