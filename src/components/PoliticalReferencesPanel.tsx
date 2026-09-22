"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Trash2, Search } from "lucide-react";
import { buildTerritoryTree, TerritoryTreeRow } from "@/components/TerritoryTree";

interface Territory {
  id: string;
  name: string;
  type: string;
  hierarchyProfileId: string;
  parentId: string | null;
  deletedAt: string | null;
}

interface Authority {
  id: string;
  territoryId: string;
  holderType: "person" | "organization";
  holderId: string;
  role: string;
  title: string;
}

interface AffiliationDetail {
  territoryId: string;
  status: "accepted" | "draft";
  chain: Territory[];
  missingRequiredTypes: string[];
  authorities: Authority[];
}

interface PersonOrOrg {
  id: string;
  name: string;
}

interface PoliticalReference {
  id: string;
  targetType: "person" | "organization";
  targetId: string;
  label: string;
}

async function json<T>(res: Response): Promise<T> {
  return res.json();
}

function useHolderName(holderType: "person" | "organization", holderId: string) {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/politics/${holderType === "person" ? "people" : "organizations"}?q=`)
      .then((r) => json<{ people?: PersonOrOrg[]; organizations?: PersonOrOrg[] }>(r))
      .then((d) => {
        if (cancelled) return;
        const list = d.people ?? d.organizations ?? [];
        setName(list.find((p) => p.id === holderId)?.name ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [holderType, holderId]);
  return name;
}

function AuthorityRow({ authority, territoryName, name }: { authority: Authority; territoryName: string; name: string | undefined }) {
  return (
    <li className="politics-list-row">
      <span>
        <strong>{authority.role}</strong>
        {authority.title ? ` (${authority.title})` : ""} of {territoryName}
        {" — "}
        {name ?? "…"}
      </span>
      <a href={`/politics?type=${authority.holderType}&id=${authority.holderId}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm">
        View
      </a>
    </li>
  );
}

/** Root → leaf hierarchy order (matching the Territories tab's Authorities
 * list): the highest-ranked territory in the chain comes first, and
 * authorities within the same territory (or that fall outside the chain
 * entirely, which shouldn't normally happen here) tie-break alphabetically
 * by holder name. */
function useSortedChainAuthorities(chain: Territory[], authorities: Authority[]) {
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    const personIds = new Set(authorities.filter((a) => a.holderType === "person").map((a) => a.holderId));
    const orgIds = new Set(authorities.filter((a) => a.holderType === "organization").map((a) => a.holderId));
    if (personIds.size === 0 && orgIds.size === 0) return;

    Promise.all([
      personIds.size > 0 ? fetch("/api/politics/people?q=").then((r) => json<{ people: PersonOrOrg[] }>(r)) : Promise.resolve({ people: [] }),
      orgIds.size > 0 ? fetch("/api/politics/organizations?q=").then((r) => json<{ organizations: PersonOrOrg[] }>(r)) : Promise.resolve({ organizations: [] }),
    ]).then(([peopleRes, orgsRes]) => {
      const map: Record<string, string> = {};
      for (const p of peopleRes.people) if (personIds.has(p.id)) map[p.id] = p.name;
      for (const o of orgsRes.organizations) if (orgIds.has(o.id)) map[o.id] = o.name;
      setNames(map);
    });
  }, [authorities]);

  const territoryIndexById = useMemo(() => new Map(chain.map((t, i) => [t.id, i])), [chain]);

  const sorted = useMemo(() => {
    return [...authorities].sort((a, b) => {
      const rankA = territoryIndexById.get(a.territoryId) ?? Number.POSITIVE_INFINITY;
      const rankB = territoryIndexById.get(b.territoryId) ?? Number.POSITIVE_INFINITY;
      if (rankA !== rankB) return rankA - rankB;
      return (names[a.holderId] ?? "").localeCompare(names[b.holderId] ?? "");
    });
  }, [authorities, territoryIndexById, names]);

  return { sorted, names, territoryIndexById };
}

function TerritoryPicker({ onPick }: { onPick: (territoryId: string) => void }) {
  const [q, setQ] = useState("");
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Fetch the full, unfiltered set once so parent/child relationships can be
  // rendered as a tree — a name-filtered fetch can return a child without
  // its ancestors, which breaks indentation. Search instead falls back to a
  // flat, client-side filtered match list (same pattern as the Politics
  // management page's territory tree).
  useEffect(() => {
    fetch("/api/politics/territories")
      .then((r) => json<{ territories: Territory[] }>(r))
      .then((d) => setTerritories(d.territories));
  }, []);

  const tree = useMemo(() => buildTerritoryTree(territories), [territories]);
  const searching = q.trim().length > 0;
  const searchResults = useMemo(() => {
    if (!searching) return [];
    const needle = q.trim().toLowerCase();
    return territories.filter((t) => t.name.toLowerCase().includes(needle));
  }, [searching, q, territories]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="politics-picker">
      <div className="politics-picker-search">
        <Search size={14} strokeWidth={2.25} />
        <input
          type="text"
          placeholder="Search territories, or browse the hierarchy below…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <ul className="politics-list politics-tree">
        {searching
          ? searchResults.map((t) => (
              <li key={t.id} className="politics-list-row">
                <button type="button" className="politics-list-pick" onClick={() => onPick(t.id)}>
                  {t.name} <span className="field-label">({t.type})</span>
                </button>
              </li>
            ))
          : tree.map((root) => (
              <TerritoryTreeRow key={root.id} node={root} depth={0} expanded={expanded} onToggleExpand={toggleExpand} onSelect={onPick} />
            ))}
        {searching && searchResults.length === 0 && <li className="field-label">No matches.</li>}
      </ul>
      <a href="/politics" target="_blank" rel="noopener noreferrer" className="btn btn-sm">
        Create a new territory
      </a>
    </div>
  );
}

export default function PoliticalReferencesPanel({
  markerId,
  onAcceptedChainChange,
}: {
  markerId: string;
  /** Reports the accepted chain (or null) after every load/refresh, so the
   * Basic Information summary can show it without a second, duplicate
   * /affiliation fetch of its own. */
  onAcceptedChainChange?: (chain: { id: string; name: string }[] | null) => void;
}) {
  const [accepted, setAccepted] = useState<AffiliationDetail | null>(null);
  const [draft, setDraft] = useState<AffiliationDetail | null>(null);
  const [references, setReferences] = useState<PoliticalReference[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const { sorted: sortedAuthorities, names: authorityNames } = useSortedChainAuthorities(accepted?.chain ?? [], accepted?.authorities ?? []);

  function refresh() {
    fetch(`/api/markers/${markerId}/affiliation`)
      .then((r) => json<{ accepted: AffiliationDetail | null; draft: AffiliationDetail | null }>(r))
      .then((d) => {
        setAccepted(d.accepted);
        setDraft(d.draft);
        setLoaded(true);
        onAcceptedChainChange?.(d.accepted?.chain ?? null);
      });
    fetch(`/api/markers/${markerId}/political-references`)
      .then((r) => json<{ references: PoliticalReference[] }>(r))
      .then((d) => setReferences(d.references));
  }

  // This panel is always mounted (just hidden via CSS when another section
  // is active — see MarkerPanel), so a mount-time fetch already has the
  // data ready before the user ever switches to this tab. Re-running on
  // every `active` flip was a second, redundant round trip on every section
  // switch; mutations below already call refresh() themselves when needed.
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markerId]);

  async function putAffiliation(territoryId: string, status: "accepted" | "draft") {
    const res = await fetch(`/api/markers/${markerId}/affiliation`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ territoryId, status }),
    });
    return res;
  }

  // A picked territory is accepted outright when the server considers it a
  // complete, attachable chain; anything short of that (incomplete
  // ancestry, or a non-attachable level like a bare Duchy) is saved as an
  // explicit draft instead of failing silently or forcing extra clicks.
  async function pickTerritory(territoryId: string) {
    const acceptRes = await putAffiliation(territoryId, "accepted");
    if (acceptRes.ok) {
      setPickerOpen(false);
      refresh();
      return;
    }
    const draftRes = await putAffiliation(territoryId, "draft");
    if (!draftRes.ok) {
      const data = await draftRes.json();
      window.alert(data.error ?? "Could not set affiliation.");
      return;
    }
    setPickerOpen(false);
    refresh();
  }

  async function removeAffiliation(status: "accepted" | "draft") {
    await fetch(`/api/markers/${markerId}/affiliation?status=${status}`, { method: "DELETE" });
    refresh();
  }

  async function removeReference(refId: string) {
    await fetch(`/api/markers/${markerId}/political-references/${refId}`, { method: "DELETE" });
    setReferences((prev) => prev.filter((r) => r.id !== refId));
  }

  if (!loaded) return <p className="field-label">Loading…</p>;

  return (
    <div className="politics-panel">
      <h3 className="marker-section-title">Affiliation</h3>
      {accepted ? (
        <div className="politics-chain">
          {accepted.chain.map((t, i) => (
            <span key={t.id}>
              {i > 0 && " › "}
              <a href={`/politics?type=territory&id=${t.id}`} target="_blank" rel="noopener noreferrer">
                {t.name} <span className="field-label">({t.type})</span>
              </a>
            </span>
          ))}
          <button type="button" className="btn btn-sm btn-danger" onClick={() => removeAffiliation("accepted")}>
            <Trash2 size={13} strokeWidth={2.25} />
            Remove affiliation
          </button>
        </div>
      ) : (
        <p className="field-label">No affiliation set — this marker is politically unassigned.</p>
      )}

      {draft && (
        <div className="politics-draft-banner">
          <strong>Incomplete affiliation draft:</strong>{" "}
          {draft.chain.map((t) => `${t.name} (${t.type})`).join(" › ") || "(none)"}
          {draft.missingRequiredTypes.length > 0 && <> — missing: {draft.missingRequiredTypes.join(", ")}</>}
          <div className="marker-panel-actions">
            <button
              type="button"
              className="btn btn-sm btn-primary"
              disabled={draft.missingRequiredTypes.length > 0}
              onClick={async () => {
                const res = await putAffiliation(draft.chain[draft.chain.length - 1].id, "accepted");
                if (!res.ok) {
                  const data = await res.json();
                  window.alert(data.error ?? "Could not accept affiliation.");
                  return;
                }
                refresh();
              }}
            >
              Accept as complete
            </button>
            <button type="button" className="btn btn-sm" onClick={() => removeAffiliation("draft")}>
              Discard draft
            </button>
          </div>
        </div>
      )}

      {pickerOpen ? (
        <TerritoryPicker onPick={pickTerritory} />
      ) : (
        <button type="button" className="btn btn-sm" onClick={() => setPickerOpen(true)}>
          {accepted ? "Change affiliation" : "Set affiliation"}
        </button>
      )}

      {accepted && sortedAuthorities.length > 0 && (
        <>
          <h3 className="marker-section-title">Authorities</h3>
          <ul className="politics-list">
            {sortedAuthorities.map((a) => (
              <AuthorityRow
                key={a.id}
                authority={a}
                territoryName={accepted.chain.find((t) => t.id === a.territoryId)?.name ?? ""}
                name={authorityNames[a.holderId]}
              />
            ))}
          </ul>
        </>
      )}

      <h3 className="marker-section-title">Marker-specific references</h3>
      {references.length === 0 && <p className="field-label">No related people or organizations linked yet.</p>}
      <ul className="politics-list">
        {references.map((ref) => (
          <PoliticalReferenceRow key={ref.id} reference={ref} onRemove={() => removeReference(ref.id)} />
        ))}
      </ul>
      <PoliticalReferenceAdder
        markerId={markerId}
        onAdded={(ref) => setReferences((prev) => [...prev, ref])}
      />
    </div>
  );
}

function PoliticalReferenceRow({ reference, onRemove }: { reference: PoliticalReference; onRemove: () => void }) {
  const name = useHolderName(reference.targetType, reference.targetId);
  return (
    <li className="politics-list-row">
      <span>
        {reference.label ? `${reference.label}: ` : ""}
        {name ?? "…"}
      </span>
      <div style={{ display: "flex", gap: "4px" }}>
        <a href={`/politics?type=${reference.targetType}&id=${reference.targetId}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm">
          View
        </a>
        <button type="button" className="btn btn-ghost btn-icon" onClick={onRemove} aria-label="Remove reference">
          <X size={14} strokeWidth={2.25} />
        </button>
      </div>
    </li>
  );
}

function PoliticalReferenceAdder({ markerId, onAdded }: { markerId: string; onAdded: (ref: PoliticalReference) => void }) {
  const [open, setOpen] = useState(false);
  const [targetType, setTargetType] = useState<"person" | "organization">("person");
  const [q, setQ] = useState("");
  const [label, setLabel] = useState("");
  const [results, setResults] = useState<PersonOrOrg[]>([]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      fetch(`/api/politics/${targetType === "person" ? "people" : "organizations"}?q=${encodeURIComponent(q)}`)
        .then((r) => json<{ people?: PersonOrOrg[]; organizations?: PersonOrOrg[] }>(r))
        .then((d) => setResults(d.people ?? d.organizations ?? []));
    }, 200);
    return () => clearTimeout(timer);
  }, [open, targetType, q]);

  async function pick(targetId: string) {
    const res = await fetch(`/api/markers/${markerId}/political-references`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType, targetId, label }),
    });
    const data = await res.json();
    if (res.ok) {
      onAdded(data.reference);
      setOpen(false);
      setQ("");
      setLabel("");
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-sm" onClick={() => setOpen(true)}>
        Add reference
      </button>
    );
  }

  return (
    <div className="politics-picker">
      <select value={targetType} onChange={(e) => setTargetType(e.target.value as "person" | "organization")}>
        <option value="person">Person</option>
        <option value="organization">Organization / House / Council</option>
      </select>
      <input type="text" placeholder="Relationship label (e.g. Claimant, Advisor)" value={label} onChange={(e) => setLabel(e.target.value)} />
      <div className="politics-picker-search">
        <Search size={14} strokeWidth={2.25} />
        <input type="text" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ul className="politics-list">
        {results.map((r) => (
          <li key={r.id} className="politics-list-row">
            <button type="button" className="politics-list-pick" onClick={() => pick(r.id)}>
              {r.name}
            </button>
          </li>
        ))}
      </ul>
      <a href="/politics" target="_blank" rel="noopener noreferrer" className="btn btn-sm">
        Create a new person/organization
      </a>
      <button type="button" className="btn btn-sm" onClick={() => setOpen(false)}>
        Cancel
      </button>
    </div>
  );
}
