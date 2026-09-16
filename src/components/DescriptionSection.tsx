"use client";

import { useState } from "react";
import RichEditor from "./RichEditor";

export default function DescriptionSection({
  documentId,
  editable,
  onDocumentCreated,
}: {
  documentId: string | null;
  editable: boolean;
  onDocumentCreated: (id: string) => void;
}) {
  const [creating, setCreating] = useState(false);

  if (!documentId) {
    if (!editable) return null;
    return (
      <button
        className="btn"
        disabled={creating}
        onClick={async () => {
          setCreating(true);
          const res = await fetch("/api/documents", { method: "POST" });
          const { document } = await res.json();
          onDocumentCreated(document.id);
          setCreating(false);
        }}
      >
        {creating ? "Adding…" : "Add description"}
      </button>
    );
  }

  return <RichEditor documentId={documentId} editable={editable} />;
}
