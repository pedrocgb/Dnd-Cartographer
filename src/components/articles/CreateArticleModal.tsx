"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { isRecordTemplate, type ArticleTemplateKey, type GenericTemplateKey } from "@/server/articles/templates";
import { INFO_FIELD_SETS } from "@/server/articles/info-sets";
import { ARTICLE_TEMPLATES, templateOf } from "./templates";

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
      <Modal open onClose={onClose} title={`New ${chosen.label} Article`} size="wide">
        <div className="create-article-form">
          <p className="create-article-form-lead">
            <chosen.Icon size={18} strokeWidth={2} aria-hidden />
            <span>Fill in the {chosen.label.toLowerCase()}&rsquo;s name and required information. Everything else can be added from its Informations card later.</span>
          </p>
          {renderForm(chosen.key, () => setOnForm(false))}
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title="Create new article" size="wide">
      <div className="template-grid" role="radiogroup" aria-label="Article template">
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
        {!chosen && <p className="field-label">Pick a template to start from.</p>}
        {chosen && hasCreateForm(chosen.key) && (
          <p className="field-label">You&rsquo;ll fill in the {chosen.label.toLowerCase()}&rsquo;s details next.</p>
        )}
        {chosen && !hasCreateForm(chosen.key) && (
          <input
            type="text"
            aria-label={`${chosen.label} title`}
            placeholder={`${chosen.label} title`}
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
            {chosen && hasCreateForm(chosen.key) ? "Continue" : busy ? "Creating…" : "Create"}
          </button>
          <button type="button" className="btn btn-sm" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
