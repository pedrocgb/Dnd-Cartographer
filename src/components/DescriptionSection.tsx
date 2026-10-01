"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import RichEditor from "./RichEditor";

async function createDocument(): Promise<string> {
  const res = await fetch("/api/documents", { method: "POST" });
  if (!res.ok) throw new Error("Could not create the description.");
  const { document } = await res.json();
  return document.id;
}

/**
 * A description is always there to write in: one that doesn't exist yet is
 * created as soon as it's shown editable (an empty one shows nothing in
 * read mode), so there's no "Add description" step.
 */
export default function DescriptionSection({
  documentId,
  editable,
  onDocumentCreated,
}: {
  documentId: string | null;
  editable: boolean;
  onDocumentCreated: (id: string) => void;
}) {
  const [failed, setFailed] = useState(false);
  // One request per mount, also under Strict Mode's doubled effects.
  const requested = useRef(false);
  const onCreated = useRef(onDocumentCreated);
  useEffect(() => {
    onCreated.current = onDocumentCreated;
  });

  const create = useCallback(() => {
    requested.current = true;
    createDocument().then(
      (id) => onCreated.current(id),
      () => {
        requested.current = false;
        setFailed(true);
      },
    );
  }, []);

  useEffect(() => {
    // Once one exists, a later record shown here without one (same mount) gets its own.
    if (documentId) requested.current = false;
    else if (editable && !requested.current) create();
  }, [editable, documentId, create]);

  if (!documentId) {
    if (!editable) return null;
    if (failed) {
      return (
        <p className="form-error">
          Could not create the description.{" "}
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              setFailed(false);
              create();
            }}
          >
            Try again
          </button>
        </p>
      );
    }
    return <p className="field-label">Preparing the description…</p>;
  }

  return <RichEditor documentId={documentId} editable={editable} />;
}
