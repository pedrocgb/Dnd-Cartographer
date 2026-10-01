"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Download, Upload } from "lucide-react";
import { SettingRow, SettingsCard, SettingsHeader } from "./parts";

interface ImportSummary {
  mapsCreated: number;
  markersCreated: number;
  documentsCreated: number;
  assetsQueued: number;
}

/** Import a world export (POST /api/import): additive, nothing existing is overwritten. */
function ImportForm() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  async function onFile(file: File) {
    setBusy(true);
    setError(null);
    setSummary(null);
    try {
      const res = await fetch("/api/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: await file.text() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Import failed.");
      setSummary(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <SettingRow label="Import a world export" description="Adds the file's maps, markers and descriptions as new items. Images are re-tiled in the background.">
        <input
          ref={inputRef}
          id="settings-import-file"
          type="file"
          accept="application/json,.json"
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onFile(file);
          }}
        />
        <button type="button" className="btn" disabled={busy} onClick={() => inputRef.current?.click()}>
          <Upload size={15} strokeWidth={2.25} />
          {busy ? "Importing…" : "Choose file…"}
        </button>
      </SettingRow>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {summary && (
        <div className="settings-notice" role="status">
          <p>
            Imported {summary.mapsCreated} map(s), {summary.markersCreated} marker(s) and {summary.documentsCreated} description(s). {summary.assetsQueued} image(s) queued for tiling.
          </p>
          <Link href="/maps" className="btn btn-sm">
            Go to Maps
            <ArrowRight size={14} strokeWidth={2.25} />
          </Link>
        </div>
      )}
    </>
  );
}

export default function DataSettings() {
  return (
    <>
      <SettingsHeader title="Data" description="Move your maps between installations, or keep a copy." />
      <SettingsCard title="Maps data" description="Covers maps, their images, markers, categories and descriptions.">
        <SettingRow label="Export" description="Downloads everything as one .json file, images included.">
          <a className="btn" href="/api/export" download>
            <Download size={15} strokeWidth={2.25} />
            Export
          </a>
        </SettingRow>
        <ImportForm />
      </SettingsCard>
    </>
  );
}
