"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { isRecordTemplate, type ArticleTemplateKey, type GenericTemplateKey } from "@/server/articles/templates";
import { INFO_FIELD_SETS } from "@/server/articles/info-sets";
import { ARTICLE_TEMPLATES, templateOf } from "./templates";
import { useT } from "@/i18n/useT";

/**
 * "Create new article": every template as a large button. A template with
 * required fields (territory, character, organization, and any whose info
 * set lists `required`) continues to its create form in this same modal,
 * with Back to the chooser; the rest just ask for a title here.
 */
export function hasCreateForm(template: ArticleTemplateKey): boolean {
  return isRecordTemplate(template) || (INFO_FIELD_SETS[template]?.required.length ?? 0) > 0;
}

export default function CreateArticleModal({
  initialTemplate,
  onClose,
  onCreate,
  renderForm,
}: {
  initialTemplate: ArticleTemplateKey | null;
  onClose: () => void;
  /** Creates a generic article; resolves an error message on failure. */
  onCreate: (template: GenericTemplateKey, title: string) => Promise<string | null>;
  /** The template's create form (see hasCreateForm), shown in place of the chooser; `onBack` returns to it. */
  renderForm: (template: ArticleTemplateKey, onBack: () => void) => React.ReactNode;
}) {
  const t = useT("articles");
  const tc = useT("common");
  const [selected, setSelected] = useState<ArticleTemplateKey | null>(initialTemplate);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** On the chosen template's create form rather than the chooser. */
  const [onForm, setOnForm] = useState(false);
  const chosen = selected ? templateOf(selected) : null;

  async function submit() {
    if (!selected) return;
    if (hasCreateForm(selected)) {
      setOnForm(true);
      return;
    }
    if (!title.trim() || busy) return;
    setBusy(true);
    setError(await onCreate(selected as GenericTemplateKey, title.trim()));
    setBusy(false);
  }

  if (onForm && chosen) {
    return (
      <Modal open onClose={onClose} title={t("create.formTitle", { label: chosen.label })} size="wide">
        <div className="create-article-form">
          <p className="create-article-form-lead">
            <chosen.Icon size={18} strokeWidth={2} aria-hidden />
            <span>{t("create.formLead", { kind: chosen.label.toLowerCase() })}</span>
          </p>
          {renderForm(chosen.key, () => setOnForm(false))}
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title={t("create.title")} size="wide">
      <div className="template-grid" role="radiogroup" aria-label={t("create.templates")}>
        {ARTICLE_TEMPLATES.map(({ key, label, Icon, description }) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={selected === key}
            className={selected === key ? "template-tile selected" : "template-tile"}
            onClick={() => {
              setSelected(key);
              setError(null);
            }}
          >
            <Icon size={26} strokeWidth={1.75} aria-hidden />
            <span className="template-tile-name">{label}</span>
            <span className="template-tile-description">{description}</span>
          </button>
        ))}
      </div>

      <form
        className="template-footer"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {!chosen && <p className="field-label">{t("create.pick")}</p>}
        {chosen && hasCreateForm(chosen.key) && (
          <p className="field-label">{t("create.next", { kind: chosen.label.toLowerCase() })}</p>
        )}
        {chosen && !hasCreateForm(chosen.key) && (
          <input
            type="text"
            aria-label={t("create.titleField", { label: chosen.label })}
            placeholder={t("create.titleField", { label: chosen.label })}
            value={title}
            maxLength={200}
            autoFocus
            onChange={(e) => setTitle(e.target.value)}
          />
        )}
        {error && <p className="form-error">{error}</p>}
        <div className="marker-panel-actions">
          <button
            type="submit"
            className="btn btn-sm btn-primary"
            disabled={!chosen || busy || (!hasCreateForm(chosen.key) && !title.trim())}
          >
            {chosen && hasCreateForm(chosen.key) ? t("create.continue") : busy ? tc("creating") : tc("create")}
          </button>
          <button type="button" className="btn btn-sm" onClick={onClose}>
            {tc("cancel")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
