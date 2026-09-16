"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Upload, ArrowRight } from "lucide-react";

interface ImportSummary {
  mapsCreated: number;
  markersCreated: number;
  documentsCreated: number;
  assetsQueued: number;
}

export default function ImportPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  async function onFile(file: File) {
    setBusy(true);
    setError(null);
    setSummary(null);
    try {
      const text = await file.text();
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: text,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed.");
      setSummary(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="upload-form">
      <h1>Import a world export</h1>
      <p>
        Adds the maps, markers, and descriptions from the file as new items in your current
        workspace — nothing existing is overwritten. Uploaded images are re-tiled in the
        background after import.
      </p>
      <label className="field-label" htmlFor="import-file">
        Export file (.json)
      </label>
      <input
        id="import-file"
        type="file"
        accept="application/json"
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
        }}
      />
      {busy && (
        <p style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <Upload size={15} strokeWidth={2.25} />
          Importing…
        </p>
      )}
      {error && <p className="form-error">{error}</p>}
      {summary && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <p>
            Imported {summary.mapsCreated} map(s), {summary.markersCreated} marker(s),{" "}
            {summary.documentsCreated} description(s). {summary.assetsQueued} image(s) queued for
            tiling.
          </p>
          <button className="btn btn-primary" onClick={() => router.push("/maps")}>
            Go to Maps
            <ArrowRight size={15} strokeWidth={2.25} />
          </button>
        </div>
      )}
    </div>
  );
}
