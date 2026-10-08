"use client";

import Link from "next/link";
import { Check, Dices, FilePlus2, Lock, ExternalLink } from "lucide-react";
import Modal from "@/components/Modal";
import type { HistoryEntry } from "@/lib/character-on-demand/history";
import { beardLabel, genderLabel, hairLabel, speciesLabel } from "@/lib/character-on-demand/labels";
import { optionLabel } from "@/server/articles/info-sets";
import { useT } from "@/i18n/useT";

function Fact({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="tool-fact">
      <span className="tool-fact-label">{label}</span>
      <span className="tool-fact-value">{value}</span>
    </div>
  );
}

/**
 * A generated character: name, look and backstory, with the way into a
 * Character article. Once an article exists it links there instead, so the
 * same character isn't created twice.
 */
export default function CharacterModal({
  entry,
  onClose,
  onRegenerate,
  onCreateArticle,
  busy,
  error,
}: {
  entry: HistoryEntry | null;
  onClose: () => void;
  onRegenerate: () => void;
  onCreateArticle: (entry: HistoryEntry) => void;
  busy: "generate" | "create" | null;
  error: string | null;
}) {
  const t = useT("character");
  if (!entry) return null;
  const c = entry.character;
  const hair = hairLabel(c.hairstyle, c.hairColor, t);
  const initials = c.name
    .split(" ")
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("");
  const b = c.backstory;

  return (
    <Modal open onClose={onClose} title={t("title")} size="wide">
      <div className="tool-hero">
        <div className="tool-avatar" aria-hidden>
          {initials}
        </div>
        <div className="tool-hero-text">
          <h3 className="tool-hero-name">{c.name}</h3>
          <div className="tool-tags">
            <span className="tool-tag">{genderLabel(c.gender, t)}</span>
            <span className="tool-tag">{speciesLabel(c.species, t)}</span>
            {c.background && <span className="tool-tag tool-tag-accent">{optionLabel(c.background)}</span>}
          </div>
        </div>
      </div>

      {(hair || c.beard || b) && (
        <div className="tool-sheet">
          {(hair || c.beard) && (
            <div className="tool-facts">
              <Fact label={t("modal.hair")} value={hair} />
              <Fact label={t("modal.beard")} value={c.beard && beardLabel(c.beard, t)} />
            </div>
          )}

          {b && (
            <div className="cod-story">
              <section>
                <h4>{t("modal.appearance")}</h4>
                <p>{b.appearance}</p>
              </section>
              <section>
                <h4>{t("modal.rightNow")}</h4>
                <p>{b.want}</p>
              </section>
              <div className="cod-story-pair">
                <section>
                  <h4>{t("modal.quirk")}</h4>
                  <p>{b.quirk}</p>
                </section>
                <section>
                  <h4>{t("modal.fear")}</h4>
                  <p>{b.fear}</p>
                </section>
              </div>
              <section className="cod-story-secret">
                <h4>
                  <Lock size={13} strokeWidth={2.25} aria-hidden />
                  {t("modal.secret")}
                </h4>
                <p>{b.secret}</p>
              </section>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="tool-modal-actions">
        <button type="button" className="btn btn-sm btn-ghost" onClick={onRegenerate} disabled={busy !== null}>
          <Dices size={15} strokeWidth={2.25} aria-hidden />
          {t("modal.another")}
        </button>
        {entry.personId ? (
          <>
            <span className="cod-created">
              <Check size={15} strokeWidth={2.5} aria-hidden />
              {t("modal.created")}
            </span>
            <Link href={`/articles?type=character&id=${encodeURIComponent(entry.personId)}`} className="btn btn-sm btn-primary">
              <ExternalLink size={15} strokeWidth={2.25} aria-hidden />
              {t("modal.open")}
            </Link>
          </>
        ) : (
          <button type="button" className="btn btn-sm btn-primary" onClick={() => onCreateArticle(entry)} disabled={busy !== null}>
            <FilePlus2 size={15} strokeWidth={2.25} aria-hidden />
            {busy === "create" ? t("modal.creating") : t("modal.create")}
          </button>
        )}
      </div>
    </Modal>
  );
}
