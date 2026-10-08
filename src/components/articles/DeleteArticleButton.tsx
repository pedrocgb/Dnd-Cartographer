"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import type { ArticleTemplateKey } from "@/server/articles/templates";
import { templateOf } from "./templates";
import { useT } from "@/i18n/useT";

/**
 * An article's Delete button and its confirmation dialog. Server refusals
 * (e.g. a territory that still has sub-territories) show inside the dialog.
 */
export default function DeleteArticleButton({
  url,
  name,
  template,
  onDeleted,
}: {
  /** The record's DELETE endpoint. */
  url: string;
  name: string;
  template: ArticleTemplateKey;
  onDeleted: () => void;
}) {
  const t = useT("articles");
  const tc = useT("common");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // "Delete this character?" — but not "this generic?" / "this magic & spells?".
  const kind = template === "generic" || template === "magic" ? t("delete.kindArticle") : templateOf(template).label.toLowerCase();
  const [beforeName, afterName] = t("delete.body").split("{name}");

  function close() {
    setOpen(false);
    setError(null);
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { method: "DELETE" });
      if (res.ok) {
        close();
        onDeleted();
      } else {
        setError((await res.json().catch(() => ({}))).error ?? t("delete.failed", { kind }));
      }
    } catch {
      setError(t("delete.offline", { kind }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="btn btn-sm btn-danger" onClick={() => setOpen(true)}>
        <Trash2 size={13} strokeWidth={2.25} />
        {t("delete.button")}
      </button>
      <ConfirmDialog
        open={open}
        title={t("delete.title", { kind })}
        confirmLabel={t("delete.confirm", { kind })}
        busyLabel={tc("deleting")}
        busy={busy}
        error={error}
        onConfirm={confirm}
        onCancel={close}
      >
        <p>
          {beforeName}
          <strong>{name}</strong>
          {afterName}
        </p>
        <ul>
          <li>{t("delete.links")}</li>
          <li>{t("delete.restore")}</li>
        </ul>
      </ConfirmDialog>
    </>
  );
}
