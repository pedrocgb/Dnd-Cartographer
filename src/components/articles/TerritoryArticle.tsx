"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { ArrowDownWideNarrow, Pencil, Plus, Trash2 } from "lucide-react";
import {
  AUTHORITY_ROLES,
  isAttachableType,
  isValidParentType,
} from "@/server/politics/hierarchy-config";
import { parseTags } from "@/server/articles/tags";
import { addedInfo, columnPatch, emptyRequiredInfo, type InfoValues, isNameSecret } from "@/server/articles/info-fields";
import { TERRITORY_INFO } from "@/server/articles/info-sets";
import { useRelationValues } from "@/components/relations/relations-context";
import { ancestorsOf, buildTerritoryTree, TerritoryTreeRow } from "@/components/TerritoryTree";
import PortraitUploader from "@/components/PortraitUploader";
import ArticleView from "./ArticleView";
import DeleteArticleButton from "./DeleteArticleButton";
import InfoPicker from "./InfoPicker";
import { InfoEditLabel, InfoForm, InfoRow, InfoView, type InfoLookups } from "./InfoBar";
import { CollapsibleBlock, TypeSelect, json, patchRecord, useEditingResetOnSelect } from "./shared";
import type { AffiliatedMarker, Authority, HierarchyProfile, OpenArticle, Territory } from "./types";
import { writeArticleDrag } from "./article-drag";
import { useT } from "@/i18n/useT";
import { authorityRoleLabel, hierarchyProfileName, territoryTypeLabel } from "@/server/politics/hierarchy-config";

const recordUrl = (id: string) => `/api/politics/territories/${id}`;

/** The Territories sidebar folder: the full hierarchy as an expandable tree. */
export function TerritoryFolder({
  territories,
  selectedId,
  onSelect,
  expanded,
  onToggleExpand,
}: {
  territories: Territory[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
}) {
  const tree = useMemo(() => buildTerritoryTree(territories), [territories]);
  return (
    <>
      {tree.map((root) => (
        <TerritoryTreeRow
          key={root.id}
          node={root}
          depth={0}
          expanded={expanded}
          onToggleExpand={onToggleExpand}
          onSelect={onSelect}
          selectedId={selectedId}
          onDragRow={(e, id) => writeArticleDrag(e, { kind: "article", id, from: null })}
        />
      ))}
    </>
  );
}

/**
 * A territory's structural hierarchy — type, parent, profile — with the
 * parent choices limited to what the chosen profile allows for the chosen
 * type. "Can P be C's parent?" is governed by C's own selected profile (not
 * P's) — see isValidParentType's contract — so it re-filters whenever either
 * changes. A type outside the profile's ladder (e.g. a custom type) is left
 * unconstrained, matching the server.
 */
function useHierarchy(profiles: HierarchyProfile[], territories: Territory[], initial?: Territory) {
  const [type, setType] = useState(initial?.type ?? "");
  const [parentId, setParentId] = useState(initial?.parentId ?? "");
  const [hierarchyProfileId, setHierarchyProfileId] = useState(initial?.hierarchyProfileId ?? profiles[0]?.id ?? "");

  const childLevels = profiles.find((p) => p.id === hierarchyProfileId)?.levels ?? [];
  const validParents = territories.filter((t) => t.id !== initial?.id && isValidParentType(t.type, type, childLevels));

  // Render-time adjustment (not an effect): drop a parent that stopped being
  // valid after a type/profile change rather than submitting it.
  if (parentId && !validParents.some((t) => t.id === parentId)) {
    setParentId("");
  }

  const body = { type, parentId: parentId || null, hierarchyProfileId: hierarchyProfileId || undefined };
  return { type, setType, parentId, setParentId, hierarchyProfileId, setHierarchyProfileId, validParents, body };
}

/** Territory Type, first under the name (a fixed row). */
function TypeRow({ h }: { h: ReturnType<typeof useHierarchy> }) {
  const ta = useT("articles");
  return (
    <div className="info-edit-row info-edit-fixed">
      <InfoEditLabel Icon={ArrowDownWideNarrow} label={ta("territory.type")} />
      <div className="info-edit-stack">
        <TypeSelect value={h.type} onChange={h.setType} />
      </div>
    </div>
  );
}

/** Hierarchy Profile, after the required Government Form (a fixed row). */
function ProfileRow({ h, profiles }: { h: ReturnType<typeof useHierarchy>; profiles: HierarchyProfile[] }) {
  const ta = useT("articles");
  const tp = useT("politics");
  return (
    <div className="info-edit-row info-edit-fixed">
      <InfoEditLabel Icon={ArrowDownWideNarrow} label={ta("territory.profile")} />
      <select aria-label={ta("territory.profile")} value={h.hierarchyProfileId} onChange={(e) => h.setHierarchyProfileId(e.target.value)}>
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {hierarchyProfileName(p.name, tp)}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Parent Territory's editor: only the territories the type and profile allow. Its value lives in `h`, not the info values. */
function ParentPicker({ h }: { h: ReturnType<typeof useHierarchy> }) {
  const ta = useT("articles");
  const tp = useT("politics");
  return (
    <div className="info-edit-stack">
      <InfoPicker
        options={h.validParents.map((t) => ({ value: t.id, label: tp("nameWithType", { name: t.name, type: territoryTypeLabel(t.type, tp) }) }))}
        value={h.parentId || null}
        placeholder={ta("territory.noneRoot")}
        clearLabel={ta("territory.noneRoot")}
        ariaLabel={ta("territory.parent")}
        dataField="parentTerritory"
        onChange={(id) => h.setParentId(id ?? "")}
      />
      {h.type && h.validParents.length === 0 && (
        <p className="info-edit-note">{ta("territory.noValidParent", { type: territoryTypeLabel(h.type, tp) })}</p>
      )}
    </div>
  );
}

/** The hierarchy part of a territory PATCH/POST: the parent only while its field is added. */
function hierarchyBody(h: ReturnType<typeof useHierarchy>, values: InfoValues) {
  return {
    type: h.type,
    hierarchyProfileId: h.hierarchyProfileId || undefined,
    ...columnPatch(TERRITORY_INFO, values),
    parentId: "parentTerritory" in values ? h.parentId || null : null,
  };
}

/** Creating a territory asks for its name, type, government form and profile; everything else (a parent too) is added from its Info Bar. */
export function TerritoryForm({
  profiles,
  territories,
  onSaved,
  onCancel,
  onBack,
}: {
  profiles: HierarchyProfile[];
  territories: Territory[];
  onSaved: (t: Territory) => void;
  onCancel: () => void;
  onBack?: () => void;
}) {
  const tc = useT("common");
  const h = useHierarchy(profiles, territories);
  return (
    <InfoForm
      set={TERRITORY_INFO}
      name=""
      initialValues={emptyRequiredInfo(TERRITORY_INFO)}
      lookups={{}}
      fixedRows={<TypeRow h={h} />}
      fixedRowsAfter={<ProfileRow h={h} profiles={profiles} />}
      allowAdding={false}
      saveLabel={tc("create")}
      savingLabel={tc("creating")}
      onSave={(name, values) =>
        fetch("/api/politics/territories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, ...hierarchyBody(h, values), info: values }),
        })
      }
      onSaved={async (res) => onSaved((await res.json()).territory)}
      onCancel={onCancel}
      onBack={onBack}
    />
  );
}

/** Edit mode of a territory's Info Bar: hierarchy rows plus its info fields, saved in one PATCH. */
function TerritoryInfoForm({
  territory,
  profiles,
  territories,
  lookups,
  onSaved,
  onCancel,
}: {
  territory: Territory;
  profiles: HierarchyProfile[];
  territories: Territory[];
  lookups: InfoLookups;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const h = useHierarchy(profiles, territories, territory);
  const relationValues = useRelationValues(TERRITORY_INFO, territory.id);
  return (
    <InfoForm
      set={TERRITORY_INFO}
      name={territory.name}
      initialValues={addedInfo(TERRITORY_INFO, territory, relationValues)}
      lookups={lookups}
      fixedRows={<TypeRow h={h} />}
      fixedRowsAfter={<ProfileRow h={h} profiles={profiles} />}
      editorFor={(field) => (field.key === "parentTerritory" ? <ParentPicker h={h} /> : undefined)}
      onSave={(name, values) => patchRecord(recordUrl(territory.id), { name, ...hierarchyBody(h, values), info: values })}
      onSaved={onSaved}
      onCancel={onCancel}
    />
  );
}

export function TerritoryArticle({
  territory,
  profiles,
  territories,
  lookups,
  tagSuggestions,
  onChanged,
  onDeleted,
  onOpenArticle,
}: {
  territory: Territory;
  profiles: HierarchyProfile[];
  territories: Territory[];
  lookups: InfoLookups;
  tagSuggestions: string[];
  onChanged: () => void;
  onDeleted: () => void;
  onOpenArticle: OpenArticle;
}) {
  const ta = useT("articles");
  const tp = useT("politics");
  const [editing, setEditing] = useEditingResetOnSelect(territory.id);
  const [chain, setChain] = useState<Territory[]>([]);
  const [authorities, setAuthorities] = useState<Authority[]>([]);
  const [missing, setMissing] = useState<string[]>([]);
  const [affiliatedMarkers, setAffiliatedMarkers] = useState<AffiliatedMarker[]>([]);
  const shownRelationValues = useRelationValues(TERRITORY_INFO, territory.id, { forView: true });

  function refreshDetail() {
    fetch(`${recordUrl(territory.id)}?withChain=true`)
      .then((r) => json<{ chain: Territory[]; authorities: Authority[]; missingRequiredTypes: string[]; affiliatedMarkers: AffiliatedMarker[] }>(r))
      .then((d) => {
        setChain(d.chain);
        setAuthorities(d.authorities);
        setMissing(d.missingRequiredTypes);
        setAffiliatedMarkers(d.affiliatedMarkers);
      });
  }
  useEffect(refreshDetail, [territory.id]);

  // "Required types" describe what a *marker's* attachment chain must
  // contain, so "missing: County" would show on every Empire/Kingdom view
  // too. Only warn for a territory whose own type is an attachment point.
  const ownProfile = profiles.find((p) => p.id === territory.hierarchyProfileId);
  const isAttachmentPoint = ownProfile ? isAttachableType(territory.type, ownProfile.levels) : false;
  // Ancestors only (root → immediate parent); the name is the article title.
  const ancestorChain = useMemo(() => ancestorsOf(territory, territories), [territory, territories]);

  const update = (body: Record<string, unknown>) => patchRecord(recordUrl(territory.id), body).then(onChanged);

  return (
    <ArticleView
      template="territory"
      title={territory.name}
      nameSecret={isNameSecret(territory.info)}
      subtitle={territoryTypeLabel(territory.type, tp)}
      tags={parseTags(territory.tags)}
      tagSuggestions={tagSuggestions}
      onChangeTags={(tags) => void update({ tags })}
      actions={
        <DeleteArticleButton url={recordUrl(territory.id)} name={territory.name} template="territory" onDeleted={onDeleted} />
      }
      image={
        <PortraitUploader
          endpoint={`${recordUrl(territory.id)}/portrait`}
          portraitKey={territory.portraitKey}
          updatedAt={territory.updatedAt}
          label={ta("portrait.coatOfArms")}
          onChanged={onChanged}
        />
      }
      infoActions={
        !editing && (
          <button className="btn btn-sm btn-ghost" onClick={() => setEditing(true)}>
            <Pencil size={13} strokeWidth={2.25} />
            {ta("view.edit")}
          </button>
        )
      }
      info={
        editing ? (
          <TerritoryInfoForm
            key={territory.id}
            territory={territory}
            profiles={profiles}
            territories={territories}
            lookups={lookups}
            onSaved={() => {
              setEditing(false);
              onChanged();
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <div className="politics-form">
            {ancestorChain.length > 0 && (
              <nav className="politics-breadcrumb">
                {ancestorChain.map((ancestor, i) => (
                  <span key={ancestor.id}>
                    {i > 0 && <span className="politics-breadcrumb-sep">→</span>}
                    <button type="button" onClick={() => onOpenArticle("territory", ancestor.id)}>
                      {ancestor.name}
                    </button>
                  </span>
                ))}
              </nav>
            )}
            <InfoView
              set={TERRITORY_INFO}
              values={addedInfo(TERRITORY_INFO, territory, shownRelationValues)}
              lookups={lookups}
              onOpenArticle={onOpenArticle}
              leading={<InfoRow label={ta("territory.type")}>{territoryTypeLabel(territory.type, tp)}</InfoRow>}
            />
            {/* Set apart from the info above by a larger gap. */}
            <div className="info-bar-sections">
            {isAttachmentPoint && missing.length > 0 && <p className="form-error">{ta("territory.incomplete", { types: missing.map((type) => territoryTypeLabel(type, tp)).join(", ") })}</p>}
            <CollapsibleBlock title={ta("territory.authorities")}>
              <AuthorityManager
                territoryId={territory.id}
                authorities={authorities}
                chain={chain}
                onChanged={refreshDetail}
                onOpenHolder={(type, id) => onOpenArticle(type === "person" ? "character" : "organization", id)}
              />
            </CollapsibleBlock>
            <CollapsibleBlock title={ta("territory.affiliated")}>
              <AffiliatedMarkersSection markers={affiliatedMarkers} territoryId={territory.id} />
            </CollapsibleBlock>
            </div>
          </div>
        )
      }
      body={{ documentId: territory.descriptionDocumentId, onCreated: (id) => update({ descriptionDocumentId: id }) }}
      sidebar={{ documentId: territory.sidebarDocumentId, onCreated: (id) => update({ sidebarDocumentId: id }) }}
      footer={{
        documentId: territory.footerDocumentId,
        onCreated: (id) => update({ footerDocumentId: id }),
        onRemove: () => update({ footerDocumentId: null }),
      }}
    />
  );
}

const AFFILIATED_MARKERS_PAGE_SIZES = [5, 10, 15, 20];
const AFFILIATED_MARKERS_PAGE_SIZE_STORAGE_KEY = "politics.affiliatedMarkersPageSize";

/** Remembered across visits (and territories) so "20 / page" needs picking only once. */
function loadStoredPageSize(): number {
  if (typeof window === "undefined") return 10;
  const raw = window.localStorage.getItem(AFFILIATED_MARKERS_PAGE_SIZE_STORAGE_KEY);
  const parsed = raw ? Number(raw) : NaN;
  return AFFILIATED_MARKERS_PAGE_SIZES.includes(parsed) ? parsed : 10;
}

function AffiliatedMarkersSection({ markers, territoryId }: { markers: AffiliatedMarker[]; territoryId: string }) {
  const ta = useT("articles");
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState(loadStoredPageSize);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return markers;
    return markers.filter((m) => m.name.toLowerCase().includes(needle));
  }, [markers, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  // Render-time adjustment: a narrower search or larger page size can leave
  // `page` past the end — pull it back rather than render an empty page.
  const clampedPage = Math.min(page, pageCount - 1);
  if (clampedPage !== page) setPage(clampedPage);

  const pageItems = filtered.slice(clampedPage * pageSize, clampedPage * pageSize + pageSize);

  return (
    <>
      <div className="affiliated-markers-controls">
        <input
          type="text"
          placeholder={ta("territory.searchMarkers")}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
        />
        <select
          aria-label={ta("territory.perPageLabel")}
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
              {ta("territory.perPage", { n })}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 && (
        <p className="field-label">{markers.length === 0 ? ta("territory.noMarkers") : ta("territory.noMarkerMatch")}</p>
      )}
      <ul className="politics-list affiliated-markers-list">
        {pageItems.map((m) => (
          <li key={m.id} className="politics-list-row">
            <a href={`/maps/${m.mapId}?marker=${m.id}`} target="_blank" rel="noopener noreferrer" className="politics-list-pick">
              {m.name}{" "}
              <span className="field-label">
                {m.viaTerritoryId !== territoryId ? ta("territory.onMapVia", { map: m.mapName, via: m.viaTerritoryName }) : ta("territory.onMap", { map: m.mapName })}
              </span>
            </a>
          </li>
        ))}
      </ul>

      {pageCount > 1 && (
        <div className="affiliated-markers-pagination">
          <button className="btn btn-sm" disabled={clampedPage === 0} onClick={() => setPage(clampedPage - 1)}>
            {ta("territory.previous")}
          </button>
          <span className="field-label">
            {ta("territory.page", { page: clampedPage + 1, count: pageCount })}
          </span>
          <button className="btn btn-sm" disabled={clampedPage >= pageCount - 1} onClick={() => setPage(clampedPage + 1)}>
            {ta("territory.next")}
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
  onOpenHolder,
}: {
  territoryId: string;
  authorities: Authority[];
  chain: Territory[];
  onChanged: () => void;
  onOpenHolder: (type: "person" | "organization", id: string) => void;
}) {
  const ta = useT("articles");
  const tc = useT("common");
  const tp = useT("politics");
  const [adding, setAdding] = useState(false);
  const [holderType, setHolderType] = useState<"person" | "organization">("person");
  const [holderId, setHolderId] = useState("");
  const [role, setRole] = useState<string>(AUTHORITY_ROLES[0]);
  const [title, setTitle] = useState("");
  const [candidates, setCandidates] = useState<{ id: string; name: string }[]>([]);

  const territoryById = useMemo(() => new Map(chain.map((t) => [t.id, t])), [chain]);

  useEffect(() => {
    if (!adding) return;
    fetch(`/api/politics/${holderType === "person" ? "people" : "organizations"}`)
      .then((r) => json<{ people?: { id: string; name: string }[]; organizations?: { id: string; name: string }[] }>(r))
      .then((d) => setCandidates(d.people ?? d.organizations ?? []));
  }, [adding, holderType]);

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
    <div className="authority-manager">
      {/* Adding sits at the top-left, above the list, so it's reachable without scrolling past every authority. */}
      {adding ? (
        <div className="politics-picker">
          <select value={holderType} onChange={(e) => setHolderType(e.target.value as "person" | "organization")}>
            <option value="person">{ta("territory.holder.person")}</option>
            <option value="organization">{ta("territory.holder.organization")}</option>
          </select>
          <select value={holderId} onChange={(e) => setHolderId(e.target.value)}>
            <option value="">{ta("select")}</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            {AUTHORITY_ROLES.map((r) => (
              <option key={r} value={r}>
                {authorityRoleLabel(r, tp)}
              </option>
            ))}
          </select>
          <input type="text" placeholder={ta("territory.titlePlaceholder")} value={title} onChange={(e) => setTitle(e.target.value)} />
          <div className="marker-panel-actions">
            <button className="btn btn-sm btn-primary" disabled={!holderId} onClick={submit}>
              {tc("save")}
            </button>
            <button className="btn btn-sm" onClick={() => setAdding(false)}>
              {tc("cancel")}
            </button>
          </div>
        </div>
      ) : (
        <button className="btn btn-sm authority-add" onClick={() => setAdding(true)}>
          <Plus size={13} strokeWidth={2.25} />
          {ta("territory.addAuthority")}
        </button>
      )}
      <ul className="politics-list">
        {authorities.map((a, i) => {
          const prev = authorities[i - 1];
          const isNewGroup = !prev || prev.territoryId !== a.territoryId;
          const territory = territoryById.get(a.territoryId);
          return (
            <Fragment key={a.id}>
              {isNewGroup && (
                <li className="politics-authority-group-label">
                  <span className="field-label">{territory ? tp("nameWithType", { name: territory.name, type: territoryTypeLabel(territory.type, tp) }) : ta("territory.otherGroup")}</span>
                </li>
              )}
              <li className="politics-list-row">
                <span>
                  <strong>{authorityRoleLabel(a.role, tp)}</strong>
                  {a.title ? ` (${a.title})` : ""} —{" "}
                  <button
                    type="button"
                    className="politics-link-button"
                    onClick={() => onOpenHolder(a.holderType, a.holderId)}
                    data-tooltip={a.holderType === "person" ? ta("territory.openCharacter") : ta("territory.openOrganization")}
                  >
                    {a.holderName}
                  </button>
                </span>
                <button className="btn btn-ghost btn-icon" onClick={() => remove(a.id)} aria-label={ta("territory.removeAuthority")}>
                  <Trash2 size={13} strokeWidth={2.25} />
                </button>
              </li>
            </Fragment>
          );
        })}
      </ul>
    </div>
  );
}
