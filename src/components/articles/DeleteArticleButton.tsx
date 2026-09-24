"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { TEMPLATE_LABELS, type ArticleTemplateKey } from "@/server/articles/templates";

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
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // "Delete this character?" — but not "this generic?" / "this magic & spells?".
  const kind = template === "generic" || template === "magic" ? "article" : TEMPLATE_LABELS[template].toLowerCase();

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
        setError((await res.json().catch(() => ({}))).error ?? `Could not delete this ${kind}.`);
      }
    } catch {
      setError(`Could not delete this ${kind}. Check your connection and try again.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="btn btn-sm btn-danger" onClick={() => setOpen(true)}>
        <Trash2 size={13} strokeWidth={2.25} />
        Delete
      </button>
      <ConfirmDialog
        open={open}
        title={`Delete this ${kind}?`}
        confirmLabel={`Delete ${kind}`}
        busyLabel="Deleting…"
        busy={busy}
        error={error}
        onConfirm={confirm}
        onCancel={close}
      >
        <p>
          <strong>&ldquo;{name}&rdquo;</strong> will be deleted, together with its body, sidebar, footer and informations.
        </p>
        <ul>
          <li>Links to it from other articles will show as &ldquo;(removed)&rdquo;.</li>
          <li>This can&rsquo;t be undone.</li>
        </ul>
      </ConfirmDialog>
    </>
  );
}
