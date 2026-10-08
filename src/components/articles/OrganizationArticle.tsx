"use client";

import { useMemo } from "react";
import { Pencil } from "lucide-react";
import { ORGANIZATION_KINDS, organizationKindLabel } from "@/server/politics/hierarchy-config";
import { parseTags } from "@/server/articles/tags";
import { addedInfo, columnPatch, emptyRequiredInfo } from "@/server/articles/info-fields";
import { ORGANIZATION_INFO } from "@/server/articles/info-sets";
import PortraitUploader from "@/components/PortraitUploader";
import ArticleView from "./ArticleView";
import DeleteArticleButton from "./DeleteArticleButton";
import { InfoForm, InfoView, type InfoLookups } from "./InfoBar";
import { PickGroupRow, patchRecord, sortByName, useEditingResetOnSelect, useExpandedSet } from "./shared";
import type { OpenArticle, Organization } from "./types";
import { useRelationValues } from "@/components/relations/relations-context";
import { useT } from "@/i18n/useT";

const recordUrl = (id: string) => `/api/politics/organizations/${id}`;

/** Folder groups: one per organization type, in ORGANIZATION_KINDS order. */
const KIND_GROUPS = ORGANIZATION_KINDS;

/** The Organizations sidebar folder, grouped by kind. */
export function OrganizationFolder({
  organizations,
  selectedId,
  onSelect,
}: {
  organizations: Organization[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const ta = useT("articles");
  const tp = useT("politics");
  const [expanded, toggleExpand] = useExpandedSet();
  const groups = useMemo(() => {
    const byKind = new Map<string, Organization[]>(KIND_GROUPS.map((k) => [k, []]));
    // A kind outside the list can't come from the form, but would otherwise vanish — file it under Other.
    for (const o of organizations) (byKind.get(o.kind) ?? byKind.get("Other")!).push(o);
    return KIND_GROUPS.map((kind) => ({ kind, members: sortByName(byKind.get(kind)!) }));
  }, [organizations]);

  return (
    <>
      {groups.map((g) => (
        <PickGroupRow
          key={g.kind}
          groupId={`kind:${g.kind}`}
          label={ta("character.groupCount", { name: organizationKindLabel(g.kind, tp), n: g.members.length })}
          members={g.members}
          expanded={expanded}
          onToggleExpand={toggleExpand}
          onSelect={onSelect}
          selectedId={selectedId}
        />
      ))}
    </>
  );
}

export function OrganizationArticle({
  organization,
  lookups,
  tagSuggestions,
  onChanged,
  onDeleted,
  onOpenArticle,
}: {
  organization: Organization;
  lookups: InfoLookups;
  tagSuggestions: string[];
  onChanged: () => void;
  onDeleted: () => void;
  onOpenArticle: OpenArticle;
}) {
  const ta = useT("articles");
  const tp = useT("politics");
  const [editing, setEditing] = useEditingResetOnSelect(organization.id);
  const relationValues = useRelationValues(ORGANIZATION_INFO, organization.id);
  const shownRelationValues = useRelationValues(ORGANIZATION_INFO, organization.id, { forView: true });

  const update = (body: Record<string, unknown>) => patchRecord(recordUrl(organization.id), body).then(onChanged);

  return (
    <ArticleView
      template="organization"
      title={organization.name}
      subtitle={organizationKindLabel(organization.kind, tp)}
      tags={parseTags(organization.tags)}
      tagSuggestions={tagSuggestions}
      onChangeTags={(tags) => void update({ tags })}
      actions={
        <DeleteArticleButton url={recordUrl(organization.id)} name={organization.name} template="organization" onDeleted={onDeleted} />
      }
      image={
        <PortraitUploader
          endpoint={`${recordUrl(organization.id)}/portrait`}
          portraitKey={organization.portraitKey}
          updatedAt={organization.updatedAt}
          label={ta("portrait.crest")}
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
          <InfoForm
            key={organization.id}
            set={ORGANIZATION_INFO}
            name={organization.name}
            initialValues={addedInfo(ORGANIZATION_INFO, organization, relationValues)}
            lookups={lookups}
            onSave={(name, values) => patchRecord(recordUrl(organization.id), { name, ...columnPatch(ORGANIZATION_INFO, values), info: values })}
            onSaved={() => {
              setEditing(false);
              onChanged();
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <InfoView set={ORGANIZATION_INFO} values={addedInfo(ORGANIZATION_INFO, organization, shownRelationValues)} lookups={lookups} onOpenArticle={onOpenArticle} />
        )
      }
      body={{ documentId: organization.descriptionDocumentId, onCreated: (id) => update({ descriptionDocumentId: id }) }}
      sidebar={{ documentId: organization.sidebarDocumentId, onCreated: (id) => update({ sidebarDocumentId: id }) }}
      footer={{
        documentId: organization.footerDocumentId,
        onCreated: (id) => update({ footerDocumentId: id }),
        onRemove: () => update({ footerDocumentId: null }),
      }}
    />
  );
}

/** Creating an organization asks for its name and type; everything else is added from its Info Bar. */
/** Creating an organization asks for its name and required fields (type preset to the first); everything else is added from its Info Bar. */
export function OrganizationForm({ onSaved, onCancel, onBack }: { onSaved: (o: Organization) => void; onCancel: () => void; onBack?: () => void }) {
  const tc = useT("common");
  return (
    <InfoForm
      set={ORGANIZATION_INFO}
      name=""
      initialValues={{ ...emptyRequiredInfo(ORGANIZATION_INFO), organizationType: ORGANIZATION_KINDS[0] }}
      lookups={{}}
      allowAdding={false}
      saveLabel={tc("create")}
      savingLabel={tc("creating")}
      onSave={(name, values) =>
        fetch("/api/politics/organizations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, ...columnPatch(ORGANIZATION_INFO, values), info: values }),
        })
      }
      onSaved={async (res) => onSaved((await res.json()).organization)}
      onCancel={onCancel}
      onBack={onBack}
    />
  );
}
