"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { TERRITORY_TYPE_CATALOG, type HierarchyLevel } from "@/server/politics/hierarchy-config";
import DescriptionSection from "@/components/DescriptionSection";
import Modal from "@/components/Modal";
import { TypeSelect, json, patchRecord, useEditingResetOnSelect } from "./shared";
import type { HierarchyProfile } from "./types";

/**
 * Hierarchy profiles: the rule-sets governing which territory types may nest
 * under which. Not an article template — reached from the bottom of the
 * Articles sidebar.
 */
export default function HierarchyProfiles({
  selectedId,
  onSelect,
  onChanged,
}: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** After a profile is created or edited, so territory forms see the new rules. */
  onChanged: () => void;
}) {
  const [profiles, setProfiles] = useState<HierarchyProfile[]>([]);
  const [creating, setCreating] = useState(false);

  function refresh() {
    fetch("/api/politics/hierarchy-profiles")
      .then((r) => json<{ profiles: HierarchyProfile[] }>(r))
      .then((d) => setProfiles(d.profiles));
  }
  useEffect(refresh, []);

  function changed() {
    refresh();
    onChanged();
  }

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
              changed();
              onSelect(p.id);
            }}
            onCancel={() => setCreating(false)}
          />
        )}
        {!creating && selected && <ProfileDetail profile={selected} onChanged={changed} />}
        {!creating && !selected && <p className="field-label">Select a hierarchy profile, or create a new one.</p>}
      </div>
    </div>
  );
}

function ProfileDetail({ profile, onChanged }: { profile: HierarchyProfile; onChanged: () => void }) {
  const [editing, setEditing] = useEditingResetOnSelect(profile.id);

  return (
    <div className="politics-form">
      {/* Name and description stay mounted (CSS-hidden while editing,
          never removed) — see PersonDetail's identical comment for why. */}
      <h2 style={editing ? { display: "none" } : undefined}>{profile.name}</h2>
      <DescriptionSection
        documentId={profile.descriptionDocumentId}
        editable={editing}
        onDocumentCreated={(id) => patchRecord(`/api/politics/hierarchy-profiles/${profile.id}`, { descriptionDocumentId: id }).then(onChanged)}
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
