"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, ChevronDown, Pencil } from "lucide-react";
import { PERSON_STATUSES } from "@/server/politics/hierarchy-config";
import { parseTags } from "@/server/articles/tags";
import { buildTerritoryTree, type TerritoryNode } from "@/components/TerritoryTree";
import PortraitUploader from "@/components/PortraitUploader";
import ArticleView from "./ArticleView";
import DeleteArticleButton from "./DeleteArticleButton";
import { PickGroupRow, PickRow, json, patchRecord, sortByName, useEditingResetOnSelect, useExpandedSet } from "./shared";
import { addedInfo, columnPatch } from "@/server/articles/info-fields";
import { CHARACTER_INFO } from "@/server/articles/info-sets";
import { InfoForm, InfoView, type InfoLookups } from "./InfoBar";
import type { Authority, OpenArticle, Organization, Person, PersonAuthority, Territory } from "./types";

const recordUrl = (id: string) => `/api/politics/people/${id}`;

type GroupMode = "all" | "house" | "authority" | "status";

const GROUP_MODES: { key: GroupMode; label: string }[] = [
  { key: "all", label: "All" },
  { key: "house", label: "House" },
  { key: "authority", label: "Authority" },
  { key: "status", label: "Status" },
];

/**
 * The Characters sidebar folder: all characters, or grouped by house,
 * status, or the territories they hold authority over.
 */
export function CharacterFolder({
  people,
  houses,
  territories,
  selectedId,
  onSelect,
}: {
  people: Person[];
  houses: Organization[];
  territories: Territory[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [mode, setMode] = useState<GroupMode>("all");
  const [expanded, toggleExpand] = useExpandedSet();
  const [personAuthorities, setPersonAuthorities] = useState<Omit<Authority, "holderName">[]>([]);

  // Only the Authority view needs every person-held authority — load it when picked.
  useEffect(() => {
    if (mode !== "authority") return;
    fetch("/api/politics/authorities?holderType=person")
      .then((r) => json<{ authorities: Omit<Authority, "holderName">[] }>(r))
      .then((d) => setPersonAuthorities(d.authorities));
  }, [mode]);

  const houseGroups = useMemo(() => {
    const houseById = new Map(houses.map((h) => [h.id, h]));
    const byHouseId = new Map<string, Person[]>();
    const unhoused: Person[] = [];
    for (const p of people) {
      if (p.houseId && houseById.has(p.houseId)) byHouseId.set(p.houseId, [...(byHouseId.get(p.houseId) ?? []), p]);
      else unhoused.push(p);
    }
    const groups = Array.from(byHouseId.entries())
      .map(([houseId, members]) => ({ house: houseById.get(houseId)!, members: sortByName(members) }))
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
    const withAuthority = new Set<string>();
    const personById = new Map(people.map((p) => [p.id, p]));
    for (const a of personAuthorities) {
      const person = personById.get(a.holderId);
      if (!person) continue;
      withAuthority.add(person.id);
      const list = assignmentsByTerritory.get(a.territoryId) ?? [];
      list.push({ personId: person.id, personName: person.name, role: a.role, title: a.title });
      assignmentsByTerritory.set(a.territoryId, list);
    }
    for (const list of assignmentsByTerritory.values()) list.sort((a, b) => a.personName.localeCompare(b.personName));

    // Prune the territory tree to territories holding a person authority, plus their ancestors.
    const byId = new Map(territories.map((t) => [t.id, t]));
    const visibleIds = new Set<string>();
    for (const territoryId of assignmentsByTerritory.keys()) {
      let current: Territory | undefined = byId.get(territoryId);
      while (current && !visibleIds.has(current.id)) {
        visibleIds.add(current.id);
        current = current.parentId ? byId.get(current.parentId) : undefined;
      }
    }
    const tree = buildTerritoryTree(territories.filter((t) => visibleIds.has(t.id)));
    return { tree, assignmentsByTerritory, withoutAuthority: sortByName(people.filter((p) => !withAuthority.has(p.id))) };
  }, [personAuthorities, people, territories]);

  const ungrouped =
    mode === "all"
      ? sortByName(people)
      : mode === "house"
        ? houseGroups.unhoused
        : mode === "status"
          ? statusGroups.noStatus
          : authorityView.withoutAuthority;

  return (
    <>
      <li className="articles-folder-modes">
        <label>
          <span className="field-label">Group by</span>
          <select value={mode} onChange={(e) => setMode(e.target.value as GroupMode)}>
            {GROUP_MODES.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </li>
      {mode === "house" &&
        houseGroups.groups.map((g) => (
          <PickGroupRow
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
      {mode === "status" &&
        statusGroups.groups.map((g) => (
          <PickGroupRow
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
      {mode === "authority" &&
        authorityView.tree.map((root) => (
          <AuthorityTreeRow
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
      {ungrouped.map((p) => (
        <PickRow key={p.id} item={p} selectedId={selectedId} onSelect={onSelect} />
      ))}
    </>
  );
}

/** The "Authority" grouping: the pruned territory hierarchy with each territory's holders as leaves. */
function AuthorityTreeRow({
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
        <button type="button" className="politics-list-pick" onClick={() => hasContent && onToggleExpand(groupId)}>
          {node.name} <span className="field-label">({node.type})</span>
        </button>
      </li>
      {isExpanded &&
        holders.map((h) => (
          <PickRow key={h.personId} item={{ id: h.personId, name: h.personName }} selectedId={selectedId} onSelect={onSelectPerson} depth={depth + 1}>
            {" "}
            <span className="field-label">({h.title || h.role})</span>
          </PickRow>
        ))}
      {isExpanded &&
        node.children.map((child) => (
          <AuthorityTreeRow
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

export function CharacterArticle({
  person,
  lookups,
  tagSuggestions,
  onChanged,
  onDeleted,
  onOpenArticle,
}: {
  person: Person;
  lookups: InfoLookups;
  tagSuggestions: string[];
  onChanged: () => void;
  onDeleted: () => void;
  onOpenArticle: OpenArticle;
}) {
  const [editing, setEditing] = useEditingResetOnSelect(person.id);
  const [authorities, setAuthorities] = useState<PersonAuthority[]>([]);

  useEffect(() => {
    fetch(recordUrl(person.id))
      .then((r) => json<{ authorities: PersonAuthority[] }>(r))
      .then((d) => setAuthorities(d.authorities))
      .catch(() => setAuthorities([]));
  }, [person.id]);

  const update = (body: Record<string, unknown>) => patchRecord(recordUrl(person.id), body).then(onChanged);

  return (
    <ArticleView
      template="character"
      title={person.name}
      tags={parseTags(person.tags)}
      tagSuggestions={tagSuggestions}
      onChangeTags={(tags) => void update({ tags })}
      actions={
        <DeleteArticleButton url={recordUrl(person.id)} name={person.name} template="character" onDeleted={onDeleted} />
      }
      image={<PortraitUploader endpoint={`${recordUrl(person.id)}/portrait`} portraitKey={person.portraitKey} updatedAt={person.updatedAt} label="Image" onChanged={onChanged} />}
      infoActions={
        !editing && (
          <button className="btn btn-sm btn-ghost" onClick={() => setEditing(true)}>
            <Pencil size={13} strokeWidth={2.25} />
            Edit
          </button>
        )
      }
      info={
        editing ? (
          <InfoForm
            key={person.id}
            set={CHARACTER_INFO}
            name={person.name}
            initialValues={addedInfo(CHARACTER_INFO, person)}
            lookups={lookups}
            onSave={(name, values) => patchRecord(recordUrl(person.id), { name, ...columnPatch(CHARACTER_INFO, values), info: values })}
            onSaved={() => {
              setEditing(false);
              onChanged();
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <InfoView
            set={CHARACTER_INFO}
            values={addedInfo(CHARACTER_INFO, person)}
            lookups={lookups}
            onOpenArticle={onOpenArticle}
            extra={
              authorities.length > 0 && (
                <div className="info-row">
                  <dt>Authorities</dt>
                  <dd>
                    {authorities.map((a, i) => (
                      <span key={`${a.territoryId}:${a.role}:${i}`}>
                        {i > 0 && ", "}
                        {a.title || a.role} of{" "}
                        <button type="button" className="politics-link-button" onClick={() => onOpenArticle("territory", a.territoryId)}>
                          {a.territoryName}
                        </button>
                      </span>
                    ))}
                  </dd>
                </div>
              )
            }
          />
        )
      }
      body={{ documentId: person.descriptionDocumentId, onCreated: (id) => update({ descriptionDocumentId: id }) }}
      sidebar={{ documentId: person.sidebarDocumentId, onCreated: (id) => update({ sidebarDocumentId: id }) }}
      footer={{
        documentId: person.footerDocumentId,
        onCreated: (id) => update({ footerDocumentId: id }),
        onRemove: () => update({ footerDocumentId: null }),
      }}
    />
  );
}

/** Creating a character asks only for its name; everything else is added from its Info Bar. */
export function PersonForm({ onSaved, onCancel }: { onSaved: (p: Person) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    const res = await fetch("/api/politics/people", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (res.ok) onSaved(data.person);
    else setError(data.error ?? "Could not save character.");
  }

  return (
    <div className="politics-form">
      <label className="field-label">Name</label>
      <input type="text" value={name} autoFocus onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void submit()} />
      <p className="field-label">House, status, appearance and more can be added from the character&rsquo;s Informations card.</p>
      {error && <p className="form-error">{error}</p>}
      <div className="marker-panel-actions">
        <button className="btn btn-sm btn-primary" onClick={submit}>
          Create
        </button>
        <button className="btn btn-sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
