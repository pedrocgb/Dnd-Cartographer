"use client";

import { useEffect, useState } from "react";
import { ExternalLink, X, Plus } from "lucide-react";

interface ConsolidatedLink {
  key: string;
  direction: "outgoing" | "incoming";
  source: string;
  targetType: "map" | "marker" | "territory" | "person" | "organization" | "external";
  targetId: string | null;
  targetName: string;
  href: string | null;
  removableLinkId: string | null;
  unavailable?: boolean;
}

async function json<T>(res: Response): Promise<T> {
  return res.json();
}

function AddLinkForm({ markerId, onAdded }: { markerId: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"internal" | "external">("external");
  const [targetType, setTargetType] = useState<"map" | "marker" | "territory" | "person" | "organization">("marker");
  const [targetId, setTargetId] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    const body =
      mode === "external"
        ? { ownerType: "marker", ownerId: markerId, externalUrl, label }
        : { ownerType: "marker", ownerId: markerId, targetType, targetId, label };
    const res = await fetch("/api/politics/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Could not add link.");
      return;
    }
    setOpen(false);
    setExternalUrl("");
    setTargetId("");
    setLabel("");
    onAdded();
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-sm" onClick={() => setOpen(true)}>
        <Plus size={14} strokeWidth={2.25} />
        Add link
      </button>
    );
  }

  return (
    <div className="politics-picker">
      <select value={mode} onChange={(e) => setMode(e.target.value as "internal" | "external")}>
        <option value="external">External URL</option>
        <option value="internal">Internal record</option>
      </select>
      {mode === "external" ? (
        <input type="text" placeholder="https://…" value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} />
      ) : (
        <>
          <select value={targetType} onChange={(e) => setTargetType(e.target.value as typeof targetType)}>
            <option value="map">Map</option>
            <option value="marker">Marker</option>
            <option value="territory">Territory</option>
            <option value="person">Person</option>
            <option value="organization">Organization</option>
          </select>
          <input type="text" placeholder="Target ID" value={targetId} onChange={(e) => setTargetId(e.target.value)} />
        </>
      )}
      <input type="text" placeholder="Label (optional)" value={label} onChange={(e) => setLabel(e.target.value)} />
      {error && <p className="form-error">{error}</p>}
      <div className="marker-panel-actions">
        <button type="button" className="btn btn-sm btn-primary" onClick={submit}>
          Save
        </button>
        <button type="button" className="btn btn-sm" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function MarkerLinksPanel({ markerId }: { markerId: string }) {
  const [links, setLinks] = useState<ConsolidatedLink[] | null>(null);

  function refresh() {
    fetch(`/api/markers/${markerId}/links`)
      .then((r) => json<{ links: ConsolidatedLink[] }>(r))
      .then((d) => setLinks(d.links));
  }

  // Always mounted (hidden via CSS when another section is active — see
  // MarkerPanel), so a mount-time fetch already has data ready before the
  // user switches to this tab; re-fetching on every tab switch was a
  // redundant round trip.
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markerId]);

  async function removeLink(linkId: string) {
    await fetch(`/api/politics/links/${linkId}`, { method: "DELETE" });
    refresh();
  }

  if (!links) return <p className="field-label">Loading…</p>;

  const outgoing = links.filter((l) => l.direction === "outgoing");
  const incoming = links.filter((l) => l.direction === "incoming");

  return (
    <div className="politics-panel">
      <h3 className="marker-section-title">Links</h3>
      {outgoing.length === 0 ? (
        <p className="field-label">No links yet.</p>
      ) : (
        <ul className="politics-list">
          {outgoing.map((l) => (
            <li key={l.key} className="politics-list-row">
              <span>
                <span className="field-label">{l.source}: </span>
                {l.unavailable ? <em>{l.targetName} (unavailable)</em> : l.targetName}
              </span>
              <div style={{ display: "flex", gap: "4px" }}>
                {l.href && l.href !== "#" && (
                  <a href={l.href} target="_blank" rel="noopener noreferrer" className="btn btn-sm">
                    <ExternalLink size={13} strokeWidth={2.25} />
                    Open
                  </a>
                )}
                {l.removableLinkId && (
                  <button type="button" className="btn btn-ghost btn-icon" onClick={() => removeLink(l.removableLinkId!)} aria-label="Remove link">
                    <X size={14} strokeWidth={2.25} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <AddLinkForm markerId={markerId} onAdded={refresh} />

      {incoming.length > 0 && (
        <>
          <h3 className="marker-section-title">Referenced by</h3>
          <ul className="politics-list">
            {incoming.map((l) => (
              <li key={l.key} className="politics-list-row">
                <span>{l.unavailable ? <em>{l.targetName} (unavailable)</em> : l.targetName}</span>
                {l.href && l.href !== "#" && (
                  <a href={l.href} target="_blank" rel="noopener noreferrer" className="btn btn-sm">
                    <ExternalLink size={13} strokeWidth={2.25} />
                    Open
                  </a>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
