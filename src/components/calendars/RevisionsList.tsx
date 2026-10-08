"use client";

import { useState } from "react";
import { api } from "./api";
import { formatRealDate } from "@/server/settings/date-format";
import { activeSettings } from "@/server/settings/active";
import { useT } from "@/i18n/useT";
import { revisionReason } from "./revision-reason";

interface Revision {
  id: string;
  version: number;
  reason: string;
  createdAt: string;
}

/** Earlier versions of a celestial object's cycle or a season profile's schedule, restorable (loaded on demand). */
export default function RevisionsList({ subjectType, subjectId, version, onRestored }: { subjectType: "celestial" | "profile"; subjectId: string; version: number; onRestored: () => void }) {
  const t = useT("calendars");
  const tc = useT("common");
  const [revisions, setRevisions] = useState<Revision[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await api<{ revisions: Revision[] }>("GET", `/api/definition-revisions?subjectType=${subjectType}&subjectId=${encodeURIComponent(subjectId)}`);
    if (res.ok) setRevisions(res.data.revisions);
    else setError(res.data.error ?? t("revisions.loadFailed"));
  }

  async function restore(id: string) {
    setBusy(true);
    const res = await api("POST", `/api/definition-revisions/${id}`, { expectedVersion: version });
    setBusy(false);
    if (res.ok) onRestored();
    else setError(res.data.error ?? t("revisions.restoreFailed"));
  }

  return (
    <details className="cal-advanced" onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && revisions === null && load()}>
      <summary>{t("revisions.title")}</summary>
      {revisions?.length === 0 && <p className="cal-help">{t("revisions.noneShort")}</p>}
      <ul className="cal-revisions">
        {revisions?.map((r) => (
          <li key={r.id}>
            <span>
              {t("revisions.row", { version: r.version, reason: revisionReason(r.reason), date: formatRealDate(r.createdAt, activeSettings().realDateFormat, { withTime: true }) })}
            </span>
            <button type="button" className="btn btn-sm" disabled={busy} onClick={() => restore(r.id)}>
              {tc("restore")}
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="form-error">{error}</p>}
    </details>
  );
}
