"use client";

import { Pencil } from "lucide-react";
import PortraitUploader from "@/components/PortraitUploader";
import { addedInfo } from "@/server/articles/info-fields";
import { INFO_FIELD_SETS } from "@/server/articles/info-sets";
import ArticleView from "./ArticleView";
import DeleteArticleButton from "./DeleteArticleButton";
import { InfoForm, InfoView, type InfoLookups } from "./InfoBar";
import { patchRecord, useEditingResetOnSelect } from "./shared";
import type { GenericArticle as GenericArticleData, OpenArticle } from "./types";

const recordUrl = (id: string) => `/api/articles/${id}`;

/**
 * An article from one of the generic templates: the shared article page,
 * plus an Info Bar when its template has info fields (INFO_FIELD_SETS).
 */
export default function GenericArticle({
  article,
  lookups,
  tagSuggestions,
  onChanged,
  onDeleted,
  onOpenArticle,
}: {
  article: GenericArticleData;
  lookups: InfoLookups;
  tagSuggestions: string[];
  onChanged: () => void;
  onDeleted: () => void;
  onOpenArticle: OpenArticle;
}) {
  const [editing, setEditing] = useEditingResetOnSelect(article.id);
  const update = (body: Record<string, unknown>) => patchRecord(recordUrl(article.id), body).then(onChanged);
  const infoSet = INFO_FIELD_SETS[article.template];

  return (
    <ArticleView
      template={article.template}
      title={article.title}
      onRename={(title) => void update({ title })}
      tags={article.tags}
      tagSuggestions={tagSuggestions}
      onChangeTags={(tags) => void update({ tags })}
      actions={
        <DeleteArticleButton url={recordUrl(article.id)} name={article.title} template={article.template} onDeleted={onDeleted} />
      }
      image={
        <PortraitUploader endpoint={`${recordUrl(article.id)}/portrait`} portraitKey={article.portraitKey} updatedAt={article.updatedAt} label="Image" onChanged={onChanged} />
      }
      infoActions={
        infoSet &&
        !editing && (
          <button className="btn btn-sm btn-ghost" onClick={() => setEditing(true)}>
            <Pencil size={13} strokeWidth={2.25} />
            Edit
          </button>
        )
      }
      info={
        infoSet &&
        (editing ? (
          <InfoForm
            key={article.id}
            set={infoSet}
            name={article.title}
            initialValues={addedInfo(infoSet, article)}
            lookups={lookups}
            onSave={(title, values) => patchRecord(recordUrl(article.id), { title, info: values })}
            onSaved={() => {
              setEditing(false);
              onChanged();
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <InfoView set={infoSet} values={addedInfo(infoSet, article)} lookups={lookups} onOpenArticle={onOpenArticle} />
        ))
      }
      body={{ documentId: article.bodyDocumentId, onCreated: (id) => update({ bodyDocumentId: id }) }}
      sidebar={{ documentId: article.sidebarDocumentId, onCreated: (id) => update({ sidebarDocumentId: id }) }}
      footer={{
        documentId: article.footerDocumentId,
        onCreated: (id) => update({ footerDocumentId: id }),
        onRemove: () => update({ footerDocumentId: null }),
      }}
    />
  );
}
