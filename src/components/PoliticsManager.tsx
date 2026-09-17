"use client";

import { useEffect, useMemo, useState } from "react";
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
  isAttachableType,
  type HierarchyLevel,
} from "@/server/politics/hierarchy-config";

interface Territory {
  id: string;
  name: string;
  type: string;
  description: string;
  parentId: string | null;
  hierarchyProfileId: string;
  governmentForm: string | null;
  powerHolders: string | null;
  leadershipSelection: string | null;
  autonomy: string | null;
  situation: string | null;
}

interface Person {
  id: string;
  name: string;
  description: string;
  houseId: string | null;
}

interface Organization {
  id: string;
  name: string;
  kind: string;
  description: string;
}

interface HierarchyProfile {
  id: string;
  name: string;
  description: string;
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

interface TerritoryNode extends Territory {
  children: TerritoryNode[];
}

function buildTerritoryTree(list: Territory[]): TerritoryNode[] {
  const byId = new Map<string, TerritoryNode>(list.map((t) => [t.id, { ...t, children: [] }]));
  const roots: TerritoryNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

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

function TerritoryTreeRow({
  node,
  depth,
  expanded,
  onToggleExpand,
  onSelect,
}: {
  node: TerritoryNode;
  depth: number;
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded.has(node.id);
  return (
    <>
      <li className="politics-list-row politics-tree-row" style={{ paddingLeft: depth * 18 }}>
        {hasChildren ? (
          <button
            type="button"
            className="politics-tree-toggle"
            onClick={() => onToggleExpand(node.id)}
            aria-label={isExpanded ? "Collapse" : "Expand"}
            aria-expanded={isExpanded}
          >
            {isExpanded ? <ChevronDown size={13} strokeWidth={2.25} /> : <ChevronRight size={13} strokeWidth={2.25} />}
          </button>
        ) : (
          <span className="politics-tree-spacer" />
        )}
        <button type="button" className="politics-list-pick" onClick={() => onSelect(node.id)}>
          {node.name} <span className="field-label">({node.type})</span>
        </button>
      </li>
      {hasChildren &&
        isExpanded &&
        node.children.map((child) => (
          <TerritoryTreeRow key={child.id} node={child} depth={depth + 1} expanded={expanded} onToggleExpand={onToggleExpand} onSelect={onSelect} />
        ))}
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

  const selected = territories.find((t) => t.id === selectedId) ?? null;

  return (
    <div className="politics-columns">
      <div className="politics-column">
        <input type="text" placeholder="Search territories…" value={q} onChange={(e) => setQ(e.target.value)} />
        <ul className="politics-list politics-tree">
          {searching
            ? searchResults.map((t) => (
                <li key={t.id} className="politics-list-row">
                  <button type="button" className="politics-list-pick" onClick={() => onSelect(t.id)}>
                    {t.name} <span className="field-label">({t.type})</span>
                  </button>
                </li>
              ))
            : tree.map((root) => (
                <TerritoryTreeRow key={root.id} node={root} depth={0} expanded={expanded} onToggleExpand={toggleExpand} onSelect={onSelect} />
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
  const [description, setDescription] = useState(initial?.description ?? "");
  const [parentId, setParentId] = useState(initial?.parentId ?? "");
  const [hierarchyProfileId, setHierarchyProfileId] = useState(initial?.hierarchyProfileId ?? profiles[0]?.id ?? "");
  const [governmentForm, setGovernmentForm] = useState(initial?.governmentForm ?? "");
  const [leadershipSelection, setLeadershipSelection] = useState(initial?.leadershipSelection ?? "");
  const [situation, setSituation] = useState(initial?.situation ?? "");
  const [autonomy, setAutonomy] = useState(initial?.autonomy ?? "");
  const [powerHolders, setPowerHolders] = useState(initial?.powerHolders ?? "");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    const body = {
      name,
      type,
      description,
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

      <label className="field-label">Description</label>
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />

      <label className="field-label">Parent territory</label>
      <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
        <option value="">None (root)</option>
        {territories
          .filter((t) => t.id !== initial?.id)
          .map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.type})
            </option>
          ))}
      </select>

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

function TerritoryDetail({
  territory,
  profiles,
  territories,
  onChanged,
  onDeleted,
}: {
  territory: Territory;
  profiles: HierarchyProfile[];
  territories: Territory[];
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [authorities, setAuthorities] = useState<Authority[]>([]);
  const [missing, setMissing] = useState<string[]>([]);

  function refreshDetail() {
    fetch(`/api/politics/territories/${territory.id}?withChain=true`)
      .then((r) => json<{ authorities: Authority[]; missingRequiredTypes: string[] }>(r))
      .then((d) => {
        setAuthorities(d.authorities);
        setMissing(d.missingRequiredTypes);
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

  if (editing) {
    return (
      <TerritoryForm
        profiles={profiles}
        territories={territories}
        initial={territory}
        onSaved={() => {
          setEditing(false);
          onChanged();
        }}
        onCancel={() => setEditing(false)}
      />
    );
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

  return (
    <div className="politics-form">
      <h2>
        {territory.name} <span className="field-label">({territory.type})</span>
      </h2>
      {isAttachmentPoint && missing.length > 0 && (
        <p className="form-error">Incomplete ancestry — missing: {missing.join(", ")}</p>
      )}
      {territory.description && <p>{territory.description}</p>}
      <div className="marker-tag-summary">
        {territory.governmentForm && <span>Government: {territory.governmentForm}</span>}
        {territory.leadershipSelection && <span>Leadership: {territory.leadershipSelection}</span>}
        {territory.situation && <span>Situation: {territory.situation}</span>}
      </div>

      <h3 className="marker-section-title">Authorities</h3>
      <AuthorityManager territoryId={territory.id} authorities={authorities} onChanged={refreshDetail} />

      <div className="marker-panel-actions">
        <button className="btn btn-sm" onClick={() => setEditing(true)}>
          Edit
        </button>
        <button className="btn btn-sm btn-danger" onClick={del}>
          <Trash2 size={13} strokeWidth={2.25} />
          Delete
        </button>
      </div>
    </div>
  );
}

function AuthorityManager({ territoryId, authorities, onChanged }: { territoryId: string; authorities: Authority[]; onChanged: () => void }) {
  const [adding, setAdding] = useState(false);
  const [holderType, setHolderType] = useState<"person" | "organization">("person");
  const [holderId, setHolderId] = useState("");
  const [role, setRole] = useState<string>(AUTHORITY_ROLES[0]);
  const [title, setTitle] = useState("");
  const [candidates, setCandidates] = useState<{ id: string; name: string }[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});

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
        {authorities.map((a) => (
          <li key={a.id} className="politics-list-row">
            <span>
              <strong>{a.role}</strong>
              {a.title ? ` (${a.title})` : ""} — {names[a.holderId] ?? "…"}
            </span>
            <button className="btn btn-ghost btn-icon" onClick={() => remove(a.id)} aria-label="Remove authority">
              <Trash2 size={13} strokeWidth={2.25} />
            </button>
          </li>
        ))}
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

function PeopleTab({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string | null) => void }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [houses, setHouses] = useState<Organization[]>([]);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);

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

  const selected = people.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="politics-columns">
      <div className="politics-column">
        <input type="text" placeholder="Search people…" value={q} onChange={(e) => setQ(e.target.value)} />
        <ul className="politics-list">
          {people.map((p) => (
            <li key={p.id} className="politics-list-row">
              <button className="politics-list-pick" onClick={() => onSelect(p.id)}>
                {p.name}
              </button>
            </li>
          ))}
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
          <PersonForm
            houses={houses}
            initial={selected}
            onSaved={refresh}
            onCancel={() => onSelect(null)}
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
  const [description, setDescription] = useState(initial?.description ?? "");
  const [houseId, setHouseId] = useState(initial?.houseId ?? "");

  async function submit() {
    const body = { name, description, houseId: houseId || null };
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
      <label className="field-label">Description</label>
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
      <label className="field-label">House</label>
      <select value={houseId} onChange={(e) => setHouseId(e.target.value)}>
        <option value="">None</option>
        {houses.map((h) => (
          <option key={h.id} value={h.id}>
            {h.name}
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
              <button className="politics-list-pick" onClick={() => onSelect(o.id)}>
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
          <OrganizationForm
            initial={selected}
            onSaved={refresh}
            onCancel={() => onSelect(null)}
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
  const [description, setDescription] = useState(initial?.description ?? "");

  async function submit() {
    const body = { name, kind, description };
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
      <label className="field-label">Description</label>
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
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
              <button className="politics-list-pick" onClick={() => onSelect(p.id)}>
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
        {!creating && selected && <ProfileForm initial={selected} onSaved={refresh} onCancel={() => onSelect(null)} />}
        {!creating && !selected && <p className="field-label">Select a hierarchy profile, or create a new one.</p>}
      </div>
    </div>
  );
}

function ProfileForm({ initial, onSaved, onCancel }: { initial?: HierarchyProfile; onSaved: (p: HierarchyProfile) => void; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [levels, setLevels] = useState<HierarchyLevel[]>(initial?.levels ?? []);
  const [error, setError] = useState<string | null>(null);

  function updateLevel(i: number, patch: Partial<HierarchyLevel>) {
    setLevels((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function submit() {
    setError(null);
    const body = { name, description, levels };
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
      <label className="field-label">Description</label>
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />

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
                <input
                  type="text"
                  placeholder="comma-separated types"
                  value={l.allowedParentTypes.join(", ")}
                  onChange={(e) => updateLevel(i, { allowedParentTypes: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                />
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
    </div>
  );
}
