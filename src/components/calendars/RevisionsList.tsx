"use client";

import { useState } from "react";
import { api } from "./api";
import { formatRealDate } from "@/server/settings/date-format";
import { activeSettings } from "@/server/settings/active";

interface Revision {
  id: string;
  version: number;
  reason: string;
  createdAt: string;
}

/** Earlier versions of a celestial object's cycle or a season profile's schedule, restorable (loaded on demand). */
export default function RevisionsList({ subjectType, subjectId, version, onRestored }: { subjectType: "celestial" | "profile"; subjectId: string; version: number; onRestored: () => void }) {
  const [revisions, setRevisions] = useState<Revision[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await api<{ revisions: Revision[] }>("GET", `/api/definition-revisions?subjectType=${subjectType}&subjectId=${encodeURIComponent(subjectId)}`);
    if (res.ok) setRevisions(res.data.revisions);
    else setError(res.data.error ?? "Could not load the versions.");
  }

  async function restore(id: string) {
    setBusy(true);
    const res = await api("POST", `/api/definition-revisions/${id}`, { expectedVersion: version });
    setBusy(false);
    if (res.ok) onRestored();
    else setError(res.data.error ?? "Could not restore that version.");
  }

  return (
    <details className="cal-advanced" onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && revisions === null && load()}>
      <summary>Earlier versions</summary>
      {revisions?.length === 0 && <p className="cal-help">None yet. One is saved every time this changes.</p>}
      <ul className="cal-revisions">
        {revisions?.map((r) => (
          <li key={r.id}>
            <span>
              Version {r.version} · {r.reason} · {formatRealDate(r.createdAt, activeSettings().realDateFormat, { withTime: true })}
            </span>
            <button type="button" className="btn btn-sm" disabled={busy} onClick={() => restore(r.id)}>
              Restore
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="form-error">{error}</p>}
    </details>
  );
}
