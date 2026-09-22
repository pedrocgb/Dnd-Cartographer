"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, ChevronRight, ChevronDown } from "lucide-react";
import {
  TERRITORY_TYPE_CATALOG,
  GOVERNMENT_FORMS,
  LEADERSHIP_SELECTIONS,
  SITUATIONS,
  ORGANIZATION_KINDS,
  AUTHORITY_ROLES,
  PERSON_STATUSES,
  isAttachableType,
  isValidParentType,
  type HierarchyLevel,
} from "@/server/politics/hierarchy-config";
import { buildTerritoryTree, TerritoryTreeRow, type TerritoryNode } from "@/components/TerritoryTree";
import PortraitUploader from "@/components/PortraitUploader";
import DescriptionSection from "@/components/DescriptionSection";
import Modal from "@/components/Modal";

interface Territory {
  id: string;
  name: string;
  type: string;
  descriptionDocumentId: string | null;
  parentId: string | null;
  hierarchyProfileId: string;
  governmentForm: string | null;
  powerHolders: string | null;
  leadershipSelection: string | null;
  autonomy: string | null;
  situation: string | null;
  portraitKey: string | null;
  updatedAt: string;
}

interface Person {
  id: string;
  name: string;
  descriptionDocumentId: string | null;
  houseId: string | null;
  portraitKey: string | null;
  status: string | null;
  updatedAt: string;
}

interface PersonAuthority {
  territoryId: string;
  territoryName: string;
  role: string;
  title: string;
}

interface Organization {
  id: string;
  name: string;
  kind: string;
  descriptionDocumentId: string | null;
  portraitKey: string | null;
  updatedAt: string;
}

interface AffiliatedMarker {
  id: string;
  name: string;
  mapId: string;
  mapName: string;
  viaTerritoryName: string;
}

interface HierarchyProfile {
  id: string;
  name: string;
  descriptionDocumentId: string | null;
  levels: HierarchyLevel[];
}

interface Authority {
  id: string;
  territoryId: string;
  holderType: "person" | "organization";
  holderId: string;
  role: string;
  title: string;
  notes: string;
}

async function json<T>(res: Response): Promise<T> {
  return res.json();
}

type Tab = "territory" | "person" | "organization" | "profile";

/**
 * A plain `<select>` — same control the rest of this form already uses
 * (Parent territory, Hierarchy profile, Government form, ...) — listing
 * every catalog type in a fixed, predictable order. A native
 * `<input list>` + `<datalist>` looked and behaved differently from every
 * other dropdown here (unstyled browser popup, and Chrome orders/filters
 * datalist options by its own heuristics rather than document order,
 * which read as "almost random"); a real `<select>` fixes both. Defaults
 * to no type selected — "Kingdom" was a silent default nobody chose.
 * "Custom…" reveals a free-text field for a type outside the catalog.
 */
const CUSTOM_TYPE_VALUE = "__custom__";

function TypeSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const isCatalogType = TERRITORY_TYPE_CATALOG.some((c) => c.type === value);
  const [customMode, setCustomMode] = useState(value !== "" && !isCatalogType);

  return (
    <>
      <select
        value={customMode ? CUSTOM_TYPE_VALUE : value}
        onChange={(e) => {
          if (e.target.value === CUSTOM_TYPE_VALUE) {
            setCustomMode(true);
            onChange("");
          } else {
            setCustomMode(false);
            onChange(e.target.value);
          }
        }}
      >
        <option value="">Select a type…</option>
        {TERRITORY_TYPE_CATALOG.map((c) => (
          <option key={c.type} value={c.type}>
            {c.type}
          </option>
        ))}
        <option value={CUSTOM_TYPE_VALUE}>Custom…</option>
      </select>
      {customMode && (
        <input type="text" placeholder="Custom type name" value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </>
  );
}

export default function PoliticsManager() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>((searchParams.get("type") as Tab) ?? "territory");
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("id"));

  return (
    <div className="politics-manager">
      <nav className="map-breadcrumbs">
        <Link href="/maps">Maps</Link> / Politics
      </nav>
      <div className="politics-tabs">
        {(["territory", "person", "organization", "profile"] as Tab[]).map((t) => (
          <button
            key={t}
            className={tab === t ? "btn active" : "btn"}
            onClick={() => {
              setTab(t);
              setSelectedId(null);
            }}
          >
            {t === "territory" ? "Territories" : t === "person" ? "People" : t === "organization" ? "Houses & Councils" : "Hierarchy Profiles"}
          </button>
        ))}
      </div>

      {tab === "territory" && <TerritoriesTab selectedId={selectedId} onSelect={setSelectedId} />}
      {tab === "person" && <PeopleTab selectedId={selectedId} onSelect={setSelectedId} />}
      {tab === "organization" && <OrganizationsTab selectedId={selectedId} onSelect={setSelectedId} />}
      {tab === "profile" && <ProfilesTab selectedId={selectedId} onSelect={setSelectedId} />}
    </div>
  );
}

function TerritoriesTab({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string | null) => void }) {
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [profiles, setProfiles] = useState<HierarchyProfile[]>([]);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // The tree view only makes sense over the *full* set — a name-filtered
  // fetch can include a child without its ancestors, so search instead
  // falls back to a flat, unindented match list.
  function refreshAll() {
    fetch("/api/politics/territories")
      .then((r) => json<{ territories: Territory[] }>(r))
      .then((d) => setTerritories(d.territories));
  }
  useEffect(refreshAll, []);
  useEffect(() => {
    fetch("/api/politics/hierarchy-profiles")
      .then((r) => json<{ profiles: HierarchyProfile[] }>(r))
      .then((d) => setProfiles(d.profiles));
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

  // Picking a search result must leave the tree in a state where that
  // territory is actually visible — expand every ancestor on the path down
  // to it (their own ancestors' expanded-ness doesn't matter here, only
  // theirs), then drop back to the tree view by clearing the search.
  function pickSearchResult(t: Territory) {
    const ancestorIds: string[] = [];
    let currentParentId = t.parentId;
    const seen = new Set<string>();
    while (currentParentId && !seen.has(currentParentId)) {
      seen.add(currentParentId);
      ancestorIds.push(currentParentId);
      currentParentId = territories.find((x) => x.id === currentParentId)?.parentId ?? null;
    }
    setExpanded((prev) => new Set([...prev, ...ancestorIds]));
    setQ("");
    onSelect(t.id);
  }

  const selected = territories.find((t) => t.id === selectedId) ?? null;

  return (
    <div className="politics-columns">
      <div className="politics-column">
        <input type="text" placeholder="Search territories…" value={q} onChange={(e) => setQ(e.target.value)} />
        <ul className="politics-list politics-tree">
          {searching
            ? searchResults.map((t) => (
                <li key={t.id} className="politics-list-row">
                  <button
                    type="button"
                    className={t.id === selectedId ? "politics-list-pick selected" : "politics-list-pick"}
                    onClick={() => pickSearchResult(t)}
                  >
                    {t.name} <span className="field-label">({t.type})</span>
                  </button>
                </li>
              ))
            : tree.map((root) => (
                <TerritoryTreeRow
                  key={root.id}
                  node={root}
                  depth={0}
                  expanded={expanded}
                  onToggleExpand={toggleExpand}
                  onSelect={onSelect}
                  selectedId={selectedId}
                />
              ))}
        </ul>
        <button className="btn btn-sm btn-primary" onClick={() => setCreating(true)}>
          <Plus size={14} strokeWidth={2.25} />
          New territory
        </button>
      </div>
      <div className="politics-column politics-detail">
        {creating && (
          <TerritoryForm
            profiles={profiles}
            territories={territories}
            onSaved={(t) => {
              setCreating(false);
              refreshAll();
              onSelect(t.id);
            }}
            onCancel={() => setCreating(false)}
          />
        )}
        {!creating && selected && (
          <TerritoryDetail
            territory={selected}
            profiles={profiles}
            territories={territories}
            onChanged={refreshAll}
            onSelectTerritory={onSelect}
            onDeleted={() => {
              onSelect(null);
              refreshAll();
            }}
          />
        )}
        {!creating && !selected && <p className="field-label">Select a territory, or create a new one.</p>}
      </div>
    </div>
  );
}

function TerritoryForm({
  profiles,
  territories,
  initial,
  onSaved,
  onCancel,
}: {
  profiles: HierarchyProfile[];
  territories: Territory[];
  initial?: Territory;
  onSaved: (t: Territory) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState(initial?.type ?? "");
  const [parentId, setParentId] = useState(initial?.parentId ?? "");
  const [hierarchyProfileId, setHierarchyProfileId] = useState(initial?.hierarchyProfileId ?? profiles[0]?.id ?? "");
  const [governmentForm, setGovernmentForm] = useState(initial?.governmentForm ?? "");
  const [leadershipSelection, setLeadershipSelection] = useState(initial?.leadershipSelection ?? "");
  const [situation, setSituation] = useState(initial?.situation ?? "");
  const [autonomy, setAutonomy] = useState(initial?.autonomy ?? "");
  const [powerHolders, setPowerHolders] = useState(initial?.powerHolders ?? "");
  const [error, setError] = useState<string | null>(null);

  // "Can P be C's parent?" is governed by C's own selected profile (not P's) —
  // see isValidParentType's contract — so re-filter whenever either the
  // chosen type or the chosen profile changes. A type outside the profile's
  // ladder (e.g. a custom type) is left unconstrained, matching the same
  // fallback the server itself uses.
  const childLevels = profiles.find((p) => p.id === hierarchyProfileId)?.levels ?? [];
  const validParents = territories.filter((t) => t.id !== initial?.id && isValidParentType(t.type, type, childLevels));

  // Render-time adjustment (not an effect): if the currently selected parent
  // is no longer a valid choice after a type/profile change, drop back to
  // "None" rather than silently submitting a stale, now-invalid parent.
  if (parentId && !validParents.some((t) => t.id === parentId)) {
    setParentId("");
  }

  async function submit() {
    setError(null);
    const body = {
      name,
      type,
      parentId: parentId || null,
      hierarchyProfileId: hierarchyProfileId || undefined,
      governmentForm: governmentForm || null,
      leadershipSelection: leadershipSelection || null,
      situation: situation || null,
      autonomy: autonomy || null,
      powerHolders: powerHolders || null,
    };
    const res = initial
      ? await fetch(`/api/politics/territories/${initial.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      : await fetch("/api/politics/territories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not save territory.");
      return;
    }
    onSaved(data.territory);
  }

  return (
    <div className="politics-form">
      <label className="field-label">Name</label>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} />

      <label className="field-label">Type</label>
      <TypeSelect value={type} onChange={setType} />

      <label className="field-label">Parent territory</label>
      <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
        <option value="">None (root)</option>
        {validParents.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name} ({t.type})
          </option>
        ))}
      </select>
      {type && validParents.length === 0 && (
        <p className="field-label">No territory of a valid parent type exists yet for &ldquo;{type}&rdquo; under this profile.</p>
      )}

      <label className="field-label">Hierarchy profile</label>
      <select value={hierarchyProfileId} onChange={(e) => setHierarchyProfileId(e.target.value)}>
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <label className="field-label">Government form</label>
      <select value={governmentForm} onChange={(e) => setGovernmentForm(e.target.value)}>
        <option value="">Unspecified</option>
        {GOVERNMENT_FORMS.map((g) => (
          <option key={g} value={g}>
            {g}
          </option>
        ))}
      </select>

      <label className="field-label">Leadership selection</label>
      <select value={leadershipSelection} onChange={(e) => setLeadershipSelection(e.target.value)}>
        <option value="">Unspecified</option>
        {LEADERSHIP_SELECTIONS.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>

      <label className="field-label">Situation</label>
      <select value={situation} onChange={(e) => setSituation(e.target.value)}>
        <option value="">Unspecified</option>
        {SITUATIONS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <label className="field-label">Autonomy</label>
      <input type="text" value={autonomy} onChange={(e) => setAutonomy(e.target.value)} placeholder="e.g. Full, Limited, Vassal" />

      <label className="field-label">Power holders</label>
      <input type="text" value={powerHolders} onChange={(e) => setPowerHolders(e.target.value)} placeholder="e.g. Noble council, Merchant guilds" />

      {error && <p className="form-error">{error}</p>}
      <div className="marker-panel-actions">
        <button className="btn btn-sm btn-primary" onClick={submit}>
          Save
        </button>
        <button className="btn btn-sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/** A collapsed-by-default section with a small arrow toggle — keeps a
 * territory's card from being overwhelming when Authorities/Affiliated
 * markers grow long. */
function CollapsibleBlock({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="politics-collapsible">
      <button
        type="button"
        className="politics-collapsible-header"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <ChevronRight size={14} strokeWidth={2.25} className={open ? "politics-collapsible-chevron open" : "politics-collapsible-chevron"} />
        <span className="marker-section-title">{title}</span>
      </button>
      {open && <div className="politics-collapsible-body">{children}</div>}
    </div>
  );
}

function TerritoryDetail({
  territory,
  profiles,
  territories,
  onChanged,
  onDeleted,
  onSelectTerritory,
}: {
  territory: Territory;
  profiles: HierarchyProfile[];
  territories: Territory[];
  onChanged: () => void;
  onDeleted: () => void;
  onSelectTerritory: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [chain, setChain] = useState<Territory[]>([]);
  const [authorities, setAuthorities] = useState<Authority[]>([]);
  const [missing, setMissing] = useState<string[]>([]);
  const [affiliatedMarkers, setAffiliatedMarkers] = useState<AffiliatedMarker[]>([]);
  // This component stays mounted (same tree position) when the user selects
  // a different territory in the list — required so DescriptionSection/
  // RichEditor never remount. Without this reset, switching selection while
  // `editing` was true silently kept the edit FORM open, now pointed at the
  // newly-selected territory; combined with a form whose local state was
  // seeded from the PREVIOUS territory, that let a save persist stale
  // fields onto the wrong record. Selecting anything new should always land
  // on its read view, never inherit another territory's in-progress edit.
  const [trackedId, setTrackedId] = useState(territory.id);
  if (territory.id !== trackedId) {
    setTrackedId(territory.id);
    if (editing) setEditing(false);
  }

  function refreshDetail() {
    fetch(`/api/politics/territories/${territory.id}?withChain=true`)
      .then((r) => json<{ chain: Territory[]; authorities: Authority[]; missingRequiredTypes: string[]; affiliatedMarkers: AffiliatedMarker[] }>(r))
      .then((d) => {
        setChain(d.chain);
        setAuthorities(d.authorities);
        setMissing(d.missingRequiredTypes);
        setAffiliatedMarkers(d.affiliatedMarkers);
      });
  }
  useEffect(refreshDetail, [territory.id]);

  async function del() {
    if (!window.confirm(`Delete "${territory.name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/politics/territories/${territory.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      window.alert(data.error ?? "Could not delete territory.");
      return;
    }
    onDeleted();
  }

  // "Required types" describe what a *marker's* attachment chain must
  // contain — they're checked against every territory in a chain because
  // that's how completeness is validated for a proposed affiliation, but
  // that same computation flags "missing: County" on every Empire/Kingdom/
  // Duchy view too, since County (quite correctly) never appears in their
  // OWN ancestor chain. Only show the warning for a territory whose own
  // type is an attachment point (per its profile) — that's the only case
  // where "is this chain complete" is a meaningful question to ask about
  // the territory itself, rather than about markers attaching beneath it.
  const ownProfile = profiles.find((p) => p.id === territory.hierarchyProfileId);
  const isAttachmentPoint = ownProfile ? isAttachableType(territory.type, ownProfile.levels) : false;

  // Ancestors only (root → immediate parent), not including this territory
  // itself — its own name is already shown in the heading below. Walks the
  // already-loaded sibling `territories` list rather than fetching a chain,
  // since that full list is already available to every TerritoryDetail.
  const ancestorChain: Territory[] = [];
  {
    let currentParentId = territory.parentId;
    const seen = new Set<string>();
    while (currentParentId && !seen.has(currentParentId)) {
      seen.add(currentParentId);
      const parent = territories.find((t) => t.id === currentParentId);
      if (!parent) break;
      ancestorChain.unshift(parent);
      currentParentId = parent.parentId;
    }
  }

  return (
    <div className="politics-form">
      <PortraitUploader
        ownerPath="territories"
        ownerId={territory.id}
        portraitKey={territory.portraitKey}
        updatedAt={territory.updatedAt}
        label="Coat of arms"
        onChanged={onChanged}
      />
      {ancestorChain.length > 0 && (
        <nav className="politics-breadcrumb" style={editing ? { display: "none" } : undefined}>
          {ancestorChain.map((ancestor, i) => (
            <span key={ancestor.id}>
              {i > 0 && <span className="politics-breadcrumb-sep">→</span>}
              <button type="button" onClick={() => onSelectTerritory(ancestor.id)}>
                {ancestor.name}
              </button>
            </span>
          ))}
        </nav>
      )}
      {/* Name/type stay mounted (CSS-hidden while editing, never removed)
          so DescriptionSection right below always sits at the same tree
          position. Swapping it out for a fresh instance when toggling
          edit/view — as this used to do — unmounts RichEditor mid-session:
          the remount refetches from an empty start and can race with
          autosave, wiping real content with an empty draft. */}
      <h2 style={editing ? { display: "none" } : undefined}>
        {territory.name} <span className="field-label">({territory.type})</span>
      </h2>
      {!editing && (territory.governmentForm || territory.leadershipSelection || territory.situation) && (
        <div className="marker-tag-summary">
          {territory.governmentForm && <span>Government: {territory.governmentForm}</span>}
          {territory.leadershipSelection && <span>Leadership: {territory.leadershipSelection}</span>}
          {territory.situation && <span>Situation: {territory.situation}</span>}
        </div>
      )}
      {!editing && isAttachmentPoint && missing.length > 0 && (
        <p className="form-error">Incomplete ancestry — missing: {missing.join(", ")}</p>
      )}
      <DescriptionSection
        documentId={territory.descriptionDocumentId}
        editable={editing}
        onDocumentCreated={async (id) => {
          await fetch(`/api/politics/territories/${territory.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ descriptionDocumentId: id }),
          });
          onChanged();
        }}
      />

      {editing ? (
        <TerritoryForm
          key={territory.id}
          profiles={profiles}
          territories={territories}
          initial={territory}
          onSaved={() => {
            setEditing(false);
            onChanged();
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <CollapsibleBlock title="Authorities">
            <AuthorityManager territoryId={territory.id} authorities={authorities} chain={chain} onChanged={refreshDetail} />
          </CollapsibleBlock>

          <CollapsibleBlock title="Affiliated markers">
            <AffiliatedMarkersSection markers={affiliatedMarkers} territoryName={territory.name} />
          </CollapsibleBlock>

          <div className="marker-panel-actions politics-detail-actions">
            <button className="btn btn-sm" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button className="btn btn-sm btn-danger" onClick={del}>
              <Trash2 size={13} strokeWidth={2.25} />
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const AFFILIATED_MARKERS_PAGE_SIZES = [5, 10, 15, 20];
const AFFILIATED_MARKERS_PAGE_SIZE_STORAGE_KEY = "politics.affiliatedMarkersPageSize";

/** Remembered across visits (and across territories) so picking "20 / page"
 * once doesn't need repeating every time this section is opened. */
function loadStoredPageSize(): number {
  if (typeof window === "undefined") return 10;
  const raw = window.localStorage.getItem(AFFILIATED_MARKERS_PAGE_SIZE_STORAGE_KEY);
  const parsed = raw ? Number(raw) : NaN;
  return AFFILIATED_MARKERS_PAGE_SIZES.includes(parsed) ? parsed : 10;
}

function AffiliatedMarkersSection({ markers, territoryName }: { markers: AffiliatedMarker[]; territoryName: string }) {
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState(loadStoredPageSize);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return markers;
    return markers.filter((m) => m.name.toLowerCase().includes(needle));
  }, [markers, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  // Render-time adjustment (not an effect): a narrower search or a larger
  // page size can leave `page` pointing past the end — pull it back in
  // range immediately rather than rendering an empty page for one frame.
  const clampedPage = Math.min(page, pageCount - 1);
  if (clampedPage !== page) setPage(clampedPage);

  const pageItems = filtered.slice(clampedPage * pageSize, clampedPage * pageSize + pageSize);

  return (
    <>
      <div className="affiliated-markers-controls">
        <input
          type="text"
          placeholder="Search affiliated markers…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
        />
        <select
          aria-label="Markers per page"
          value={pageSize}
          onChange={(e) => {
            const next = Number(e.target.value);
            setPageSize(next);
            setPage(0);
            window.localStorage.setItem(AFFILIATED_MARKERS_PAGE_SIZE_STORAGE_KEY, String(next));
          }}
        >
          {AFFILIATED_MARKERS_PAGE_SIZES.map((n) => (
            <option key={n} value={n}>
              {n} / page
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 && (
        <p className="field-label">
          {markers.length === 0 ? "No markers are affiliated with this territory yet." : "No affiliated markers match your search."}
        </p>
      )}
      <ul className="politics-list affiliated-markers-list">
        {pageItems.map((m) => (
          <li key={m.id} className="politics-list-row">
            <a href={`/maps/${m.mapId}?marker=${m.id}`} target="_blank" rel="noopener noreferrer" className="politics-list-pick">
              {m.name}{" "}
              <span className="field-label">
                ({m.mapName}
                {m.viaTerritoryName !== territoryName ? ` — via ${m.viaTerritoryName}` : ""})
              </span>
            </a>
          </li>
        ))}
      </ul>

      {pageCount > 1 && (
        <div className="affiliated-markers-pagination">
          <button className="btn btn-sm" disabled={clampedPage === 0} onClick={() => setPage(clampedPage - 1)}>
            Previous
          </button>
          <span className="field-label">
            Page {clampedPage + 1} of {pageCount}
          </span>
          <button className="btn btn-sm" disabled={clampedPage >= pageCount - 1} onClick={() => setPage(clampedPage + 1)}>
            Next
          </button>
        </div>
      )}
    </>
  );
}

function AuthorityManager({
  territoryId,
  authorities,
  chain,
  onChanged,
}: {
  territoryId: string;
  authorities: Authority[];
  chain: Territory[];
  onChanged: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [holderType, setHolderType] = useState<"person" | "organization">("person");
  const [holderId, setHolderId] = useState("");
  const [role, setRole] = useState<string>(AUTHORITY_ROLES[0]);
  const [title, setTitle] = useState("");
  const [candidates, setCandidates] = useState<{ id: string; name: string }[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});

  // `chain` is root → leaf (see resolveChain), so a territory's index within
  // it doubles as its hierarchy rank — Empire before Kingdom before Duchy,
  // and so on. `authorities` spans the whole chain (every ancestor plus
  // this territory), not just this territory's own, so without this the
  // list came back in arbitrary DB order with no visible relationship
  // between entries at all.
  const territoryIndexById = useMemo(() => new Map(chain.map((t, i) => [t.id, i])), [chain]);
  const territoryById = useMemo(() => new Map(chain.map((t) => [t.id, t])), [chain]);

  const sortedAuthorities = useMemo(() => {
    return [...authorities].sort((a, b) => {
      const rankA = territoryIndexById.get(a.territoryId) ?? Number.POSITIVE_INFINITY;
      const rankB = territoryIndexById.get(b.territoryId) ?? Number.POSITIVE_INFINITY;
      if (rankA !== rankB) return rankA - rankB;
      // Same territory (or both unranked) — nothing hierarchical separates
      // them, so fall back to alphabetical by holder name.
      return (names[a.holderId] ?? "").localeCompare(names[b.holderId] ?? "");
    });
  }, [authorities, territoryIndexById, names]);

  useEffect(() => {
    if (!adding) return;
    fetch(`/api/politics/${holderType === "person" ? "people" : "organizations"}`)
      .then((r) => json<{ people?: { id: string; name: string }[]; organizations?: { id: string; name: string }[] }>(r))
      .then((d) => setCandidates(d.people ?? d.organizations ?? []));
  }, [adding, holderType]);

  useEffect(() => {
    Promise.all(
      authorities.map((a) =>
        fetch(`/api/politics/${a.holderType === "person" ? "people" : "organizations"}`)
          .then((r) => json<{ people?: { id: string; name: string }[]; organizations?: { id: string; name: string }[] }>(r))
          .then((d) => ({ id: a.holderId, name: (d.people ?? d.organizations ?? []).find((x) => x.id === a.holderId)?.name ?? a.holderId }))
      )
    ).then((results) => setNames(Object.fromEntries(results.map((r) => [r.id, r.name]))));
  }, [authorities]);

  async function submit() {
    const res = await fetch("/api/politics/authorities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ territoryId, holderType, holderId, role, title }),
    });
    if (res.ok) {
      setAdding(false);
      setHolderId("");
      setTitle("");
      onChanged();
    }
  }

  async function remove(id: string) {
    await fetch(`/api/politics/authorities/${id}`, { method: "DELETE" });
    onChanged();
  }

  return (
    <div>
      <ul className="politics-list">
        {sortedAuthorities.map((a, i) => {
          const prev = sortedAuthorities[i - 1];
          const isNewGroup = !prev || prev.territoryId !== a.territoryId;
          const isRanked = territoryIndexById.has(a.territoryId);
          const prevWasRanked = prev ? territoryIndexById.has(prev.territoryId) : true;
          const territory = territoryById.get(a.territoryId);
          return (
            <Fragment key={a.id}>
              {isNewGroup && (
                <li
                  className={
                    !isRanked && prevWasRanked
                      ? "politics-authority-group-label politics-authority-group-gap"
                      : "politics-authority-group-label"
                  }
                >
                  <span className="field-label">{territory ? `${territory.name} (${territory.type})` : "Other"}</span>
                </li>
              )}
              <li className="politics-list-row">
                <span>
                  <strong>{a.role}</strong>
                  {a.title ? ` (${a.title})` : ""} — {names[a.holderId] ?? "…"}
                </span>
                <button className="btn btn-ghost btn-icon" onClick={() => remove(a.id)} aria-label="Remove authority">
                  <Trash2 size={13} strokeWidth={2.25} />
                </button>
              </li>
            </Fragment>
          );
        })}
      </ul>
      {adding ? (
        <div className="politics-picker">
          <select value={holderType} onChange={(e) => setHolderType(e.target.value as "person" | "organization")}>
            <option value="person">Person</option>
            <option value="organization">Organization</option>
          </select>
          <select value={holderId} onChange={(e) => setHolderId(e.target.value)}>
            <option value="">Select…</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            {AUTHORITY_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <input type="text" placeholder="Title (e.g. King)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <div className="marker-panel-actions">
            <button className="btn btn-sm btn-primary" disabled={!holderId} onClick={submit}>
              Save
            </button>
            <button className="btn btn-sm" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button className="btn btn-sm" onClick={() => setAdding(true)}>
          <Plus size={13} strokeWidth={2.25} />
          Add authority
        </button>
      )}
    </div>
  );
}

type PeopleFilterMode = "all" | "house" | "authority" | "status";

const PEOPLE_FILTER_MODES: { key: PeopleFilterMode; label: string }[] = [
  { key: "all", label: "All" },
  { key: "house", label: "House" },
  { key: "authority", label: "Authority" },
  { key: "status", label: "Status" },
];

function sortByName<T extends { name: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name));
}

function PeopleTab({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string | null) => void }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [houses, setHouses] = useState<Organization[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [personAuthorities, setPersonAuthorities] = useState<Authority[]>([]);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [filterMode, setFilterMode] = useState<PeopleFilterMode>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function refresh() {
    fetch(`/api/politics/people?q=${encodeURIComponent(q)}`)
      .then((r) => json<{ people: Person[] }>(r))
      .then((d) => setPeople(d.people));
  }
  useEffect(refresh, [q]);
  useEffect(() => {
    fetch("/api/politics/organizations")
      .then((r) => json<{ organizations: Organization[] }>(r))
      .then((d) => setHouses(d.organizations));
  }, []);
  useEffect(() => {
    fetch("/api/politics/territories")
      .then((r) => json<{ territories: Territory[] }>(r))
      .then((d) => setTerritories(d.territories));
    fetch("/api/politics/authorities?holderType=person")
      .then((r) => json<{ authorities: Authority[] }>(r))
      .then((d) => setPersonAuthorities(d.authorities));
  }, []);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selected = people.find((p) => p.id === selectedId) ?? null;
  const alphabetical = useMemo(() => sortByName(people), [people]);

  const houseGroups = useMemo(() => {
    const byHouseId = new Map<string, Person[]>();
    const unhoused: Person[] = [];
    for (const p of people) {
      if (p.houseId && houses.some((h) => h.id === p.houseId)) {
        const list = byHouseId.get(p.houseId) ?? [];
        list.push(p);
        byHouseId.set(p.houseId, list);
      } else {
        unhoused.push(p);
      }
    }
    const groups = Array.from(byHouseId.entries())
      .map(([houseId, members]) => ({ house: houses.find((h) => h.id === houseId)!, members: sortByName(members) }))
      .sort((a, b) => a.house.name.localeCompare(b.house.name));
    return { groups, unhoused: sortByName(unhoused) };
  }, [people, houses]);

  const statusGroups = useMemo(() => {
    const byStatus = new Map<string, Person[]>(PERSON_STATUSES.map((s) => [s, []]));
    const noStatus: Person[] = [];
    for (const p of people) {
      if (p.status && byStatus.has(p.status)) byStatus.get(p.status)!.push(p);
      else noStatus.push(p);
    }
    return {
      groups: PERSON_STATUSES.map((s) => ({ status: s, members: sortByName(byStatus.get(s) ?? []) })),
      noStatus: sortByName(noStatus),
    };
  }, [people]);

  const authorityView = useMemo(() => {
    const assignmentsByTerritory = new Map<string, { personId: string; personName: string; role: string; title: string }[]>();
    const peopleWithAuthorityIds = new Set<string>();
    for (const a of personAuthorities) {
      const person = people.find((p) => p.id === a.holderId);
      if (!person) continue;
      peopleWithAuthorityIds.add(person.id);
      const list = assignmentsByTerritory.get(a.territoryId) ?? [];
      list.push({ personId: person.id, personName: person.name, role: a.role, title: a.title });
      assignmentsByTerritory.set(a.territoryId, list);
    }
    for (const list of assignmentsByTerritory.values()) list.sort((a, b) => a.personName.localeCompare(b.personName));

    const byId = new Map(territories.map((t) => [t.id, t]));
    const visibleIds = new Set<string>();
    for (const territoryId of assignmentsByTerritory.keys()) {
      let current: Territory | undefined = byId.get(territoryId);
      while (current && !visibleIds.has(current.id)) {
        visibleIds.add(current.id);
        current = current.parentId ? byId.get(current.parentId) : undefined;
      }
    }
    const visibleTerritories = territories.filter((t) => visibleIds.has(t.id));
    const tree = buildTerritoryTree(visibleTerritories);
    const peopleWithoutAuthority = sortByName(people.filter((p) => !peopleWithAuthorityIds.has(p.id)));
    return { tree, assignmentsByTerritory, peopleWithoutAuthority };
  }, [personAuthorities, people, territories]);

  const searching = q.trim().length > 0;

  return (
    <div className="politics-columns">
      <div className="politics-column">
        <input type="text" placeholder="Search people…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="politics-filter-row">
          {PEOPLE_FILTER_MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              className={filterMode === m.key ? "btn btn-sm active" : "btn btn-sm"}
              onClick={() => setFilterMode(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <ul className="politics-list politics-tree">
          {searching || filterMode === "all" ? (
            alphabetical.map((p) => (
              <li key={p.id} className="politics-list-row">
                <button
                  className={p.id === selectedId ? "politics-list-pick selected" : "politics-list-pick"}
                  onClick={() => onSelect(p.id)}
                >
                  {p.name}
                </button>
              </li>
            ))
          ) : filterMode === "house" ? (
            <>
              {houseGroups.groups.map((g) => (
                <PeopleGroupRow
                  key={g.house.id}
                  groupId={`house:${g.house.id}`}
                  label={`${g.house.name} (${g.members.length})`}
                  members={g.members}
                  expanded={expanded}
                  onToggleExpand={toggleExpand}
                  onSelect={onSelect}
                  selectedId={selectedId}
                />
              ))}
              {houseGroups.unhoused.map((p) => (
                <li key={p.id} className="politics-list-row">
                  <button
                    className={p.id === selectedId ? "politics-list-pick selected" : "politics-list-pick"}
                    onClick={() => onSelect(p.id)}
                  >
                    {p.name}
                  </button>
                </li>
              ))}
            </>
          ) : filterMode === "status" ? (
            <>
              {statusGroups.groups.map((g) => (
                <PeopleGroupRow
                  key={g.status}
                  groupId={`status:${g.status}`}
                  label={`${g.status} (${g.members.length})`}
                  members={g.members}
                  expanded={expanded}
                  onToggleExpand={toggleExpand}
                  onSelect={onSelect}
                  selectedId={selectedId}
                />
              ))}
              {statusGroups.noStatus.map((p) => (
                <li key={p.id} className="politics-list-row">
                  <button
                    className={p.id === selectedId ? "politics-list-pick selected" : "politics-list-pick"}
                    onClick={() => onSelect(p.id)}
                  >
                    {p.name}
                  </button>
                </li>
              ))}
            </>
          ) : (
            <>
              {authorityView.tree.map((root) => (
                <PeopleAuthorityTreeRow
                  key={root.id}
                  node={root}
                  depth={0}
                  assignmentsByTerritory={authorityView.assignmentsByTerritory}
                  expanded={expanded}
                  onToggleExpand={toggleExpand}
                  onSelectPerson={onSelect}
                  selectedId={selectedId}
                />
              ))}
              {authorityView.peopleWithoutAuthority.map((p) => (
                <li key={p.id} className="politics-list-row">
                  <button
                    className={p.id === selectedId ? "politics-list-pick selected" : "politics-list-pick"}
                    onClick={() => onSelect(p.id)}
                  >
                    {p.name}
                  </button>
                </li>
              ))}
            </>
          )}
        </ul>
        <button className="btn btn-sm btn-primary" onClick={() => setCreating(true)}>
          <Plus size={14} strokeWidth={2.25} />
          New person
        </button>
      </div>
      <div className="politics-column politics-detail">
        {creating && (
          <PersonForm
            houses={houses}
            onSaved={(p) => {
              setCreating(false);
              refresh();
              onSelect(p.id);
            }}
            onCancel={() => setCreating(false)}
          />
        )}
        {!creating && selected && (
          <PersonDetail
            person={selected}
            houses={houses}
            onChanged={refresh}
            onDeleted={() => {
              onSelect(null);
              refresh();
            }}
          />
        )}
        {!creating && !selected && <p className="field-label">Select a person, or create a new one.</p>}
      </div>
    </div>
  );
}

/** A collapsed-by-default group of people (used by the People tab's House/
 * Status filters) — same arrow-toggle convention as the territory tree. */
function PeopleGroupRow({
  groupId,
  label,
  members,
  expanded,
  onToggleExpand,
  onSelect,
  selectedId,
}: {
  groupId: string;
  label: string;
  members: Person[];
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  onSelect: (id: string) => void;
  selectedId?: string | null;
}) {
  const isExpanded = expanded.has(groupId);
  return (
    <>
      <li className="politics-list-row politics-tree-row">
        <button
          type="button"
          className="politics-tree-toggle"
          onClick={() => onToggleExpand(groupId)}
          aria-label={isExpanded ? "Collapse" : "Expand"}
          aria-expanded={isExpanded}
        >
          {isExpanded ? <ChevronDown size={13} strokeWidth={2.25} /> : <ChevronRight size={13} strokeWidth={2.25} />}
        </button>
        <button type="button" className="politics-list-pick" onClick={() => onToggleExpand(groupId)}>
          {label}
        </button>
      </li>
      {isExpanded &&
        members.map((p) => (
          <li key={p.id} className="politics-list-row politics-tree-row" style={{ paddingLeft: 18 }}>
            <span className="politics-tree-spacer" />
            <button
              className={p.id === selectedId ? "politics-list-pick selected" : "politics-list-pick"}
              onClick={() => onSelect(p.id)}
            >
              {p.name}
            </button>
          </li>
        ))}
    </>
  );
}

/** The People tab's "Authority" view: the territory hierarchy pruned down to
 * only territories that hold a person authority (or are an ancestor of one),
 * with each territory's authority-holders shown as leaves beneath it. */
function PeopleAuthorityTreeRow({
  node,
  depth,
  assignmentsByTerritory,
  expanded,
  onToggleExpand,
  onSelectPerson,
  selectedId,
}: {
  node: TerritoryNode;
  depth: number;
  assignmentsByTerritory: Map<string, { personId: string; personName: string; role: string; title: string }[]>;
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  onSelectPerson: (id: string) => void;
  selectedId?: string | null;
}) {
  const holders = assignmentsByTerritory.get(node.id) ?? [];
  const hasContent = node.children.length > 0 || holders.length > 0;
  const groupId = `territory:${node.id}`;
  const isExpanded = expanded.has(groupId);
  return (
    <>
      <li className="politics-list-row politics-tree-row" style={{ paddingLeft: depth * 18 }}>
        {hasContent ? (
          <button
            type="button"
            className="politics-tree-toggle"
            onClick={() => onToggleExpand(groupId)}
            aria-label={isExpanded ? "Collapse" : "Expand"}
            aria-expanded={isExpanded}
          >
            {isExpanded ? <ChevronDown size={13} strokeWidth={2.25} /> : <ChevronRight size={13} strokeWidth={2.25} />}
          </button>
        ) : (
          <span className="politics-tree-spacer" />
        )}
        <button
          type="button"
          className="politics-list-pick"
          onClick={() => hasContent && onToggleExpand(groupId)}
        >
          {node.name} <span className="field-label">({node.type})</span>
        </button>
      </li>
      {isExpanded &&
        holders.map((h) => (
          <li key={h.personId} className="politics-list-row politics-tree-row" style={{ paddingLeft: (depth + 1) * 18 }}>
            <span className="politics-tree-spacer" />
            <button
              className={h.personId === selectedId ? "politics-list-pick selected" : "politics-list-pick"}
              onClick={() => onSelectPerson(h.personId)}
            >
              {h.personName} <span className="field-label">({h.title || h.role})</span>
            </button>
          </li>
        ))}
      {isExpanded &&
        node.children.map((child) => (
          <PeopleAuthorityTreeRow
            key={child.id}
            node={child}
            depth={depth + 1}
            assignmentsByTerritory={assignmentsByTerritory}
            expanded={expanded}
            onToggleExpand={onToggleExpand}
            selectedId={selectedId}
            onSelectPerson={onSelectPerson}
          />
        ))}
    </>
  );
}

function PersonDetail({
  person,
  houses,
  onChanged,
  onDeleted,
}: {
  person: Person;
  houses: Organization[];
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [authorities, setAuthorities] = useState<PersonAuthority[]>([]);
  // See the identical reset in TerritoryDetail — this component stays
  // mounted across selection changes (required for DescriptionSection), so
  // without this, switching to another person while `editing` was true kept
  // the edit form open and pointed at the new person while still holding
  // the previous person's stale field values.
  const [trackedId, setTrackedId] = useState(person.id);
  if (person.id !== trackedId) {
    setTrackedId(person.id);
    if (editing) setEditing(false);
  }

  useEffect(() => {
    fetch(`/api/politics/people/${person.id}`)
      .then((r) => json<{ authorities: PersonAuthority[] }>(r))
      .then((d) => setAuthorities(d.authorities))
      .catch(() => setAuthorities([]));
  }, [person.id]);

  async function del() {
    if (!window.confirm(`Delete "${person.name}"?`)) return;
    const res = await fetch(`/api/politics/people/${person.id}`, { method: "DELETE" });
    if (res.ok) onDeleted();
    else window.alert((await res.json()).error ?? "Could not delete.");
  }

  const house = houses.find((h) => h.id === person.houseId);
  const authorityLabels = authorities.map((a) => `${a.title || a.role} of ${a.territoryName}`);

  return (
    <div className="politics-form">
      <PortraitUploader
        ownerPath="people"
        ownerId={person.id}
        portraitKey={person.portraitKey}
        updatedAt={person.updatedAt}
        label="Image"
        onChanged={onChanged}
      />
      {/* Name, tag-summary, and description stay mounted (CSS-hidden while
          editing, never removed) so DescriptionSection always sits at the
          same tree position — swapping it for a fresh instance on edit/view
          toggle unmounts RichEditor mid-session and can race with autosave,
          wiping real content with an empty draft. */}
      <h2 style={editing ? { display: "none" } : undefined}>{person.name}</h2>
      {!editing && (person.status || house || authorityLabels.length > 0) && (
        <div className="marker-tag-summary-left">
          {person.status && <span>Status: {person.status}</span>}
          {house && <span>House: {house.name}</span>}
          {authorityLabels.length > 0 && <span>Authorities: {authorityLabels.join(", ")}</span>}
        </div>
      )}
      <DescriptionSection
        documentId={person.descriptionDocumentId}
        editable={editing}
        onDocumentCreated={async (id) => {
          await fetch(`/api/politics/people/${person.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ descriptionDocumentId: id }),
          });
          onChanged();
        }}
      />

      {editing ? (
        <PersonForm
          key={person.id}
          houses={houses}
          initial={person}
          onSaved={() => {
            setEditing(false);
            onChanged();
          }}
          onCancel={() => setEditing(false)}
          onDeleted={onDeleted}
        />
      ) : (
        <div className="marker-panel-actions politics-detail-actions">
          <button className="btn btn-sm" onClick={() => setEditing(true)}>
            Edit
          </button>
          <button className="btn btn-sm btn-danger" onClick={del}>
            <Trash2 size={13} strokeWidth={2.25} />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function PersonForm({
  houses,
  initial,
  onSaved,
  onCancel,
  onDeleted,
}: {
  houses: Organization[];
  initial?: Person;
  onSaved: (p: Person) => void;
  onCancel: () => void;
  onDeleted?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [houseId, setHouseId] = useState(initial?.houseId ?? "");
  const [status, setStatus] = useState(initial?.status ?? "");

  async function submit() {
    const body = { name, houseId: houseId || null, status: status || null };
    const res = initial
      ? await fetch(`/api/politics/people/${initial.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      : await fetch("/api/politics/people", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (res.ok) onSaved(data.person);
  }

  async function del() {
    if (!initial || !onDeleted) return;
    if (!window.confirm(`Delete "${initial.name}"?`)) return;
    const res = await fetch(`/api/politics/people/${initial.id}`, { method: "DELETE" });
    if (res.ok) onDeleted();
    else window.alert((await res.json()).error ?? "Could not delete.");
  }

  return (
    <div className="politics-form">
      <label className="field-label">Name</label>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
      <label className="field-label">House</label>
      <select value={houseId} onChange={(e) => setHouseId(e.target.value)}>
        <option value="">None</option>
        {houses.map((h) => (
          <option key={h.id} value={h.id}>
            {h.name}
          </option>
        ))}
      </select>
      <label className="field-label">Status</label>
      <select value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="">Unspecified</option>
        {PERSON_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <div className="marker-panel-actions">
        <button className="btn btn-sm btn-primary" onClick={submit}>
          Save
        </button>
        <button className="btn btn-sm" onClick={onCancel}>
          {initial ? "Close" : "Cancel"}
        </button>
        {initial && onDeleted && (
          <button className="btn btn-sm btn-danger" onClick={del}>
            <Trash2 size={13} strokeWidth={2.25} />
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

function OrganizationsTab({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string | null) => void }) {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);

  function refresh() {
    fetch(`/api/politics/organizations?q=${encodeURIComponent(q)}`)
      .then((r) => json<{ organizations: Organization[] }>(r))
      .then((d) => setOrgs(d.organizations));
  }
  useEffect(refresh, [q]);

  const selected = orgs.find((o) => o.id === selectedId) ?? null;

  return (
    <div className="politics-columns">
      <div className="politics-column">
        <input type="text" placeholder="Search houses & councils…" value={q} onChange={(e) => setQ(e.target.value)} />
        <ul className="politics-list">
          {orgs.map((o) => (
            <li key={o.id} className="politics-list-row">
              <button
                className={o.id === selectedId ? "politics-list-pick selected" : "politics-list-pick"}
                onClick={() => onSelect(o.id)}
              >
                {o.name} <span className="field-label">({o.kind})</span>
              </button>
            </li>
          ))}
        </ul>
        <button className="btn btn-sm btn-primary" onClick={() => setCreating(true)}>
          <Plus size={14} strokeWidth={2.25} />
          New organization
        </button>
      </div>
      <div className="politics-column politics-detail">
        {creating && (
          <OrganizationForm
            onSaved={(o) => {
              setCreating(false);
              refresh();
              onSelect(o.id);
            }}
            onCancel={() => setCreating(false)}
          />
        )}
        {!creating && selected && (
          <OrganizationDetail
            organization={selected}
            onChanged={refresh}
            onDeleted={() => {
              onSelect(null);
              refresh();
            }}
          />
        )}
        {!creating && !selected && <p className="field-label">Select an organization, or create a new one.</p>}
      </div>
    </div>
  );
}

function OrganizationDetail({
  organization,
  onChanged,
  onDeleted,
}: {
  organization: Organization;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  // See the identical reset in TerritoryDetail.
  const [trackedId, setTrackedId] = useState(organization.id);
  if (organization.id !== trackedId) {
    setTrackedId(organization.id);
    if (editing) setEditing(false);
  }

  async function del() {
    if (!window.confirm(`Delete "${organization.name}"?`)) return;
    const res = await fetch(`/api/politics/organizations/${organization.id}`, { method: "DELETE" });
    if (res.ok) onDeleted();
    else window.alert((await res.json()).error ?? "Could not delete.");
  }

  return (
    <div className="politics-form">
      <PortraitUploader
        ownerPath="organizations"
        ownerId={organization.id}
        portraitKey={organization.portraitKey}
        updatedAt={organization.updatedAt}
        label="Crest"
        onChanged={onChanged}
      />
      {/* Name and description stay mounted (CSS-hidden while editing,
          never removed) — see PersonDetail's identical comment for why. */}
      <h2 style={editing ? { display: "none" } : undefined}>
        {organization.name} <span className="field-label">({organization.kind})</span>
      </h2>
      <DescriptionSection
        documentId={organization.descriptionDocumentId}
        editable={editing}
        onDocumentCreated={async (id) => {
          await fetch(`/api/politics/organizations/${organization.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ descriptionDocumentId: id }),
          });
          onChanged();
        }}
      />

      {editing ? (
        <OrganizationForm
          key={organization.id}
          initial={organization}
          onSaved={() => {
            setEditing(false);
            onChanged();
          }}
          onCancel={() => setEditing(false)}
          onDeleted={onDeleted}
        />
      ) : (
        <div className="marker-panel-actions politics-detail-actions">
          <button className="btn btn-sm" onClick={() => setEditing(true)}>
            Edit
          </button>
          <button className="btn btn-sm btn-danger" onClick={del}>
            <Trash2 size={13} strokeWidth={2.25} />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function OrganizationForm({
  initial,
  onSaved,
  onCancel,
  onDeleted,
}: {
  initial?: Organization;
  onSaved: (o: Organization) => void;
  onCancel: () => void;
  onDeleted?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [kind, setKind] = useState(initial?.kind ?? ORGANIZATION_KINDS[0]);

  async function submit() {
    const body = { name, kind };
    const res = initial
      ? await fetch(`/api/politics/organizations/${initial.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      : await fetch("/api/politics/organizations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (res.ok) onSaved(data.organization);
  }

  async function del() {
    if (!initial || !onDeleted) return;
    if (!window.confirm(`Delete "${initial.name}"?`)) return;
    const res = await fetch(`/api/politics/organizations/${initial.id}`, { method: "DELETE" });
    if (res.ok) onDeleted();
    else window.alert((await res.json()).error ?? "Could not delete.");
  }

  return (
    <div className="politics-form">
      <label className="field-label">Name</label>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
      <label className="field-label">Kind</label>
      <select value={kind} onChange={(e) => setKind(e.target.value)}>
        {ORGANIZATION_KINDS.map((k) => (
          <option key={k} value={k}>
            {k}
          </option>
        ))}
      </select>
      <div className="marker-panel-actions">
        <button className="btn btn-sm btn-primary" onClick={submit}>
          Save
        </button>
        <button className="btn btn-sm" onClick={onCancel}>
          {initial ? "Close" : "Cancel"}
        </button>
        {initial && onDeleted && (
          <button className="btn btn-sm btn-danger" onClick={del}>
            <Trash2 size={13} strokeWidth={2.25} />
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

function ProfilesTab({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string | null) => void }) {
  const [profiles, setProfiles] = useState<HierarchyProfile[]>([]);
  const [creating, setCreating] = useState(false);

  function refresh() {
    fetch("/api/politics/hierarchy-profiles")
      .then((r) => json<{ profiles: HierarchyProfile[] }>(r))
      .then((d) => setProfiles(d.profiles));
  }
  useEffect(refresh, []);

  const selected = profiles.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="politics-columns">
      <div className="politics-column">
        <ul className="politics-list">
          {profiles.map((p) => (
            <li key={p.id} className="politics-list-row">
              <button
                className={p.id === selectedId ? "politics-list-pick selected" : "politics-list-pick"}
                onClick={() => onSelect(p.id)}
              >
                {p.name}
              </button>
            </li>
          ))}
        </ul>
        <button className="btn btn-sm btn-primary" onClick={() => setCreating(true)}>
          <Plus size={14} strokeWidth={2.25} />
          New profile
        </button>
      </div>
      <div className="politics-column politics-detail">
        {creating && (
          <ProfileForm
            onSaved={(p) => {
              setCreating(false);
              refresh();
              onSelect(p.id);
            }}
            onCancel={() => setCreating(false)}
          />
        )}
        {!creating && selected && <ProfileDetail profile={selected} onChanged={refresh} />}
        {!creating && !selected && <p className="field-label">Select a hierarchy profile, or create a new one.</p>}
      </div>
    </div>
  );
}

function ProfileDetail({ profile, onChanged }: { profile: HierarchyProfile; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  // See the identical reset in TerritoryDetail.
  const [trackedId, setTrackedId] = useState(profile.id);
  if (profile.id !== trackedId) {
    setTrackedId(profile.id);
    if (editing) setEditing(false);
  }

  return (
    <div className="politics-form">
      {/* Name and description stay mounted (CSS-hidden while editing,
          never removed) — see PersonDetail's identical comment for why. */}
      <h2 style={editing ? { display: "none" } : undefined}>{profile.name}</h2>
      <DescriptionSection
        documentId={profile.descriptionDocumentId}
        editable={editing}
        onDocumentCreated={async (id) => {
          await fetch(`/api/politics/hierarchy-profiles/${profile.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ descriptionDocumentId: id }),
          });
          onChanged();
        }}
      />

      {editing ? (
        <ProfileForm
          key={profile.id}
          initial={profile}
          onSaved={() => {
            setEditing(false);
            onChanged();
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <label className="field-label">Levels (root to leaf)</label>
          <ul className="politics-list">
            {profile.levels.map((l, i) => (
              <li key={i} className="politics-list-row">
                <span>
                  {l.type || <em>(unset)</em>}
                  {l.canBeRoot || l.required || l.attachable ? (
                    <span className="field-label">
                      {" "}
                      (
                      {[l.canBeRoot && "root", l.required && "required", l.attachable && "attachable"].filter(Boolean).join(", ")}
                      )
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
          <div className="marker-panel-actions politics-detail-actions">
            <button className="btn btn-sm" onClick={() => setEditing(true)}>
              Edit
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ProfileForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: HierarchyProfile;
  onSaved: (p: HierarchyProfile) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [levels, setLevels] = useState<HierarchyLevel[]>(initial?.levels ?? []);
  const [error, setError] = useState<string | null>(null);
  const [editingParentsForIndex, setEditingParentsForIndex] = useState<number | null>(null);

  function updateLevel(i: number, patch: Partial<HierarchyLevel>) {
    setLevels((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function submit() {
    setError(null);
    const body = { name, levels };
    const res = initial
      ? await fetch(`/api/politics/hierarchy-profiles/${initial.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      : await fetch("/api/politics/hierarchy-profiles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not save profile.");
      return;
    }
    onSaved(data.profile);
  }

  return (
    <div className="politics-form">
      <label className="field-label">Name</label>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} />

      <label className="field-label">Levels (root to leaf)</label>
      <table className="politics-levels-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Root?</th>
            <th>Required?</th>
            <th>Attachable?</th>
            <th>Allowed parents</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {levels.map((l, i) => (
            <tr key={i}>
              <td>
                <TypeSelect value={l.type} onChange={(v) => updateLevel(i, { type: v })} />
              </td>
              <td>
                <input type="checkbox" checked={l.canBeRoot} onChange={(e) => updateLevel(i, { canBeRoot: e.target.checked })} />
              </td>
              <td>
                <input type="checkbox" checked={l.required} onChange={(e) => updateLevel(i, { required: e.target.checked })} />
              </td>
              <td>
                <input type="checkbox" checked={l.attachable} onChange={(e) => updateLevel(i, { attachable: e.target.checked })} />
              </td>
              <td>
                <button type="button" className="btn btn-sm" onClick={() => setEditingParentsForIndex(i)}>
                  Edit ({l.allowedParentTypes.length})
                </button>
              </td>
              <td>
                <button className="btn btn-ghost btn-icon" onClick={() => setLevels((prev) => prev.filter((_, idx) => idx !== i))} aria-label="Remove level">
                  <Trash2 size={13} strokeWidth={2.25} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        className="btn btn-sm"
        onClick={() => setLevels((prev) => [...prev, { type: "", canBeRoot: false, required: false, attachable: false, allowedParentTypes: [] }])}
      >
        <Plus size={13} strokeWidth={2.25} />
        Add level
      </button>

      {error && <p className="form-error">{error}</p>}
      <div className="marker-panel-actions">
        <button className="btn btn-sm btn-primary" onClick={submit}>
          Save
        </button>
        <button className="btn btn-sm" onClick={onCancel}>
          Close
        </button>
      </div>

      {editingParentsForIndex !== null && (
        <AllowedParentsModal
          selected={levels[editingParentsForIndex].allowedParentTypes}
          onToggle={(type) =>
            setLevels((prev) =>
              prev.map((l, idx) =>
                idx === editingParentsForIndex
                  ? {
                      ...l,
                      allowedParentTypes: l.allowedParentTypes.includes(type)
                        ? l.allowedParentTypes.filter((t) => t !== type)
                        : [...l.allowedParentTypes, type],
                    }
                  : l
              )
            )
          }
          onClose={() => setEditingParentsForIndex(null)}
        />
      )}
    </div>
  );
}

/** Every catalog territory type, checkbox-picked as allowed parents for one
 * hierarchy level — replaces free-typed comma-separated text, which was
 * error-prone (typos silently produced a type nothing could ever match). */
function AllowedParentsModal({
  selected,
  onToggle,
  onClose,
}: {
  selected: string[];
  onToggle: (type: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal open onClose={onClose} title="Allowed parent types">
      <ul className="allowed-parents-list">
        {TERRITORY_TYPE_CATALOG.map((c) => (
          <li key={c.type}>
            <label className="allowed-parents-option">
              <input type="checkbox" checked={selected.includes(c.type)} onChange={() => onToggle(c.type)} />
              {c.type}
            </label>
          </li>
        ))}
      </ul>
      <div className="marker-panel-actions">
        <button type="button" className="btn btn-sm btn-primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}
