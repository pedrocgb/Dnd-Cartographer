"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Download, Upload } from "lucide-react";
import { SettingRow, SettingsCard, SettingsHeader } from "./parts";
import { useT } from "@/i18n/useT";
import { formatInteger } from "@/server/settings/number-format";

interface ImportSummary {
  mapsCreated: number;
  markersCreated: number;
  documentsCreated: number;
  assetsQueued: number;
}

/** Import a world export (POST /api/import): additive, nothing existing is overwritten. */
function ImportForm() {
  const t = useT("settings");
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
      if (!res.ok) throw new Error(data.error ?? t("data.import.failed"));
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
      <SettingRow label={t("data.import")} description={t("data.import.description")}>
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
          {busy ? t("data.import.busy") : t("data.import.choose")}
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
            {t("data.import.summary", {
              maps: formatInteger(summary.mapsCreated),
              markers: formatInteger(summary.markersCreated),
              documents: formatInteger(summary.documentsCreated),
              assets: formatInteger(summary.assetsQueued),
            })}
          </p>
          <Link href="/maps" className="btn btn-sm">
            {t("data.import.goToMaps")}
            <ArrowRight size={14} strokeWidth={2.25} />
          </Link>
        </div>
      )}
    </>
  );
}

export default function DataSettings() {
  const t = useT("settings");
  return (
    <>
      <SettingsHeader title={t("data.title")} description={t("data.description")} />
      <SettingsCard title={t("data.maps.title")} description={t("data.maps.description")}>
        <SettingRow label={t("data.export")} description={t("data.export.description")}>
          <a className="btn" href="/api/export" download>
            <Download size={15} strokeWidth={2.25} />
            {t("data.export")}
          </a>
        </SettingRow>
        <ImportForm />
      </SettingsCard>
    </>
  );
}
