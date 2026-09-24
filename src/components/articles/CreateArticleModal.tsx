"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { isRecordTemplate, type ArticleTemplateKey, type RecordTemplateKey, type GenericTemplateKey } from "@/server/articles/templates";
import { ARTICLE_TEMPLATES, templateOf } from "./templates";

/**
 * "Create new article": every template as a large button. A generic template
 * then asks for a title; territory/character/organization continue to their
 * own form (they have required fields of their own).
 */
export default function CreateArticleModal({
  initialTemplate,
  onClose,
  onCreate,
  onStartRecord,
}: {
  initialTemplate: ArticleTemplateKey | null;
  onClose: () => void;
  /** Creates a generic article; resolves an error message on failure. */
  onCreate: (template: GenericTemplateKey, title: string) => Promise<string | null>;
  onStartRecord: (template: RecordTemplateKey) => void;
}) {
  const [selected, setSelected] = useState<ArticleTemplateKey | null>(initialTemplate);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chosen = selected ? templateOf(selected) : null;

  async function submit() {
    if (!selected) return;
    if (isRecordTemplate(selected)) {
      onStartRecord(selected);
      return;
    }
    if (!title.trim() || busy) return;
    setBusy(true);
    setError(await onCreate(selected, title.trim()));
    setBusy(false);
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
        {chosen && isRecordTemplate(chosen.key) && (
          <p className="field-label">You&rsquo;ll fill in the {chosen.label.toLowerCase()}&rsquo;s details next.</p>
        )}
        {chosen && !isRecordTemplate(chosen.key) && (
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
            disabled={!chosen || busy || (!isRecordTemplate(chosen.key) && !title.trim())}
          >
            {chosen && isRecordTemplate(chosen.key) ? "Continue" : busy ? "Creating…" : "Create"}
          </button>
          <button type="button" className="btn btn-sm" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
