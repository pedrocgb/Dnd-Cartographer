"use client";

import { useEffect, useState } from "react";
import { ExternalLink, X, Plus } from "lucide-react";
import { SkeletonList } from "@/components/Skeleton";
import InfoPicker, { type PickerOption } from "@/components/articles/InfoPicker";
import { loadCandidates, type Candidate } from "@/components/articles/candidates";
import SegmentedControl from "./marker-panel/SegmentedControl";
import { useT } from "@/i18n/useT";

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

type TargetType = "map" | "marker" | "territory" | "person" | "organization";

const TARGET_TYPES: TargetType[] = ["marker", "map", "territory", "person", "organization"];

/** Picker rows for a link target of `type` (markers are searched instead: there can be thousands). */
async function loadTargets(type: Exclude<TargetType, "marker">): Promise<PickerOption[]> {
  if (type === "map") {
    const d = await json<{ maps: { id: string; name: string }[] }>(await fetch("/api/maps"));
    return d.maps.map((m) => ({ value: m.id, label: m.name })).sort((x, y) => x.label.localeCompare(y.label));
  }
  const all = await loadCandidates();
  const wanted = (c: Candidate) => (type === "person" ? c.template === "character" || c.template === "playerCharacter" : c.template === type);
  return all
    .filter(wanted)
    .map((c) => ({ value: c.id, label: c.name }))
    .sort((x, y) => x.label.localeCompare(y.label));
}

/** Search-as-you-type over every marker, by name (grouped by map). */
function MarkerTargetSearch({ exclude, value, onChange }: { exclude: string; value: string | null; onChange: (id: string | null) => void }) {
  const tm = useT("maps");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ q: string; options: PickerOption[] } | null>(null);
  const q = query.trim();

  useEffect(() => {
    if (q.length < 2) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`)
        .then((r) => json<{ results: { type: string; id: string; name: string; mapName: string }[] }>(r))
        .then((d) => {
          if (cancelled) return;
          const options = d.results.filter((r) => r.type === "marker" && r.id !== exclude).map((r) => ({ value: r.id, label: r.name, group: r.mapName }));
          setResults({ q, options });
        })
        .catch(() => !cancelled && setResults({ q, options: [] }));
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [q, exclude]);

  const options = results?.q === q ? results.options : [];
  return (
    <>
      <input type="text" placeholder={tm("markerLinks.searchMarkers")} aria-label={tm("markers.searchAria")} value={query} onChange={(e) => setQuery(e.target.value)} />
      <InfoPicker
        options={options}
        value={value}
        placeholder={q.length < 2 ? tm("markerLinks.typeMore") : options.length ? tm("markerLinks.matching", { count: options.length }) : tm("markerLinks.noMatch")}
        ariaLabel={tm("markerLinks.targetMarker")}
        disabled={options.length === 0}
        onChange={onChange}
      />
    </>
  );
}

function AddLinkForm({ markerId, onAdded }: { markerId: string; onAdded: () => void }) {
  const tm = useT("maps");
  const tc = useT("common");
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"internal" | "external">("internal");
  const [targetType, setTargetType] = useState<TargetType>("marker");
  const [targetId, setTargetId] = useState<string | null>(null);
  const [targets, setTargets] = useState<{ type: TargetType; options: PickerOption[] } | null>(null);
  const [externalUrl, setExternalUrl] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || mode !== "internal" || targetType === "marker") return;
    let cancelled = false;
    loadTargets(targetType)
      .then((options) => !cancelled && setTargets({ type: targetType, options }))
      .catch(() => !cancelled && setTargets({ type: targetType, options: [] }));
    return () => {
      cancelled = true;
    };
  }, [open, mode, targetType]);

  async function submit() {
    setError(null);
    if (mode === "internal" && !targetId) return setError(tm("markerLinks.chooseTarget"));
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
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? tm("markerLinks.addFailed"));
      return;
    }
    setOpen(false);
    setExternalUrl("");
    setTargetId(null);
    setLabel("");
    onAdded();
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-sm" onClick={() => setOpen(true)}>
        <Plus size={14} strokeWidth={2.25} />
        {tm("markerLinks.add")}
      </button>
    );
  }

  const options = targets?.type === targetType ? targets.options : null;
  return (
    <div className="politics-picker">
      <SegmentedControl
        ariaLabel={tm("markerLinks.linkTo")}
        value={mode}
        onChange={setMode}
        segments={[
          { key: "internal", label: tm("markerLinks.inWorld") },
          { key: "external", label: tm("markerLinks.web") },
        ]}
      />
      {mode === "external" ? (
        <input type="text" placeholder="https://…" aria-label={tm("markerLinks.web")} value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} />
      ) : (
        <>
          <InfoPicker
            options={TARGET_TYPES.map((key) => ({ value: key, label: tm(`markerLinks.target.${key}`) }))}
            value={targetType}
            placeholder={tm("markerLinks.kind")}
            ariaLabel={tm("markerLinks.kindAria")}
            searchable={false}
            onChange={(v) => {
              if (!v) return;
              setTargetType(v as TargetType);
              setTargetId(null);
            }}
          />
          {targetType === "marker" ? (
            <MarkerTargetSearch exclude={markerId} value={targetId} onChange={setTargetId} />
          ) : (
            <InfoPicker
              options={options ?? []}
              value={targetId}
              placeholder={options === null ? tc("loading") : options.length ? tm("markerLinks.choose") : tm("markerLinks.nothing")}
              ariaLabel={tm("markerLinks.target")}
              disabled={!options?.length}
              onChange={setTargetId}
            />
          )}
        </>
      )}
      <input type="text" placeholder={tm("markerLinks.labelOptional")} aria-label={tm("markerLinks.labelAria")} value={label} onChange={(e) => setLabel(e.target.value)} />
      {error && <p className="form-error">{error}</p>}
      <div className="marker-panel-actions">
        <button type="button" className="btn btn-sm btn-primary" onClick={submit}>
          {tc("save")}
        </button>
        <button type="button" className="btn btn-sm" onClick={() => setOpen(false)}>
          {tc("cancel")}
        </button>
      </div>
    </div>
  );
}

export default function MarkerLinksPanel({ markerId }: { markerId: string }) {
  const tm = useT("maps");
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

  if (!links) return <SkeletonList rows={3} label={tm("markerLinks.loading")} />;

  const outgoing = links.filter((l) => l.direction === "outgoing");
  const incoming = links.filter((l) => l.direction === "incoming");

  return (
    <div className="politics-panel">
      <h3 className="marker-section-title">{tm("markerLinks.title")}</h3>
      {outgoing.length === 0 ? (
        <p className="field-label">{tm("markerLinks.none")}</p>
      ) : (
        <ul className="politics-list">
          {outgoing.map((l) => (
            <li key={l.key} className="politics-list-row">
              <span>
                <span className="field-label">{l.source}: </span>
                {l.unavailable ? <em>{tm("markerLinks.unavailable", { name: l.targetName })}</em> : l.targetName}
              </span>
              <div style={{ display: "flex", gap: "4px" }}>
                {l.href && l.href !== "#" && (
                  <a href={l.href} target="_blank" rel="noopener noreferrer" className="btn btn-sm">
                    <ExternalLink size={13} strokeWidth={2.25} />
                    {tm("markerLinks.open")}
                  </a>
                )}
                {l.removableLinkId && (
                  <button type="button" className="btn btn-ghost btn-icon" onClick={() => removeLink(l.removableLinkId!)} aria-label={tm("markerLinks.remove")}>
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
          <h3 className="marker-section-title">{tm("markerLinks.referencedBy")}</h3>
          <ul className="politics-list">
            {incoming.map((l) => (
              <li key={l.key} className="politics-list-row">
                <span>{l.unavailable ? <em>{tm("markerLinks.unavailable", { name: l.targetName })}</em> : l.targetName}</span>
                {l.href && l.href !== "#" && (
                  <a href={l.href} target="_blank" rel="noopener noreferrer" className="btn btn-sm">
                    <ExternalLink size={13} strokeWidth={2.25} />
                    {tm("markerLinks.open")}
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
