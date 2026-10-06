"use client";

import Link from "next/link";
import { Check, Dices, FilePlus2, Lock, ExternalLink } from "lucide-react";
import Modal from "@/components/Modal";
import { SPECIES } from "@/lib/character-on-demand/options";
import type { HistoryEntry } from "@/lib/character-on-demand/history";

const SPECIES_LABEL = Object.fromEntries(SPECIES.map((s) => [s.key, s.label]));

export const speciesLabel = (key: string) => SPECIES_LABEL[key] ?? key;

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
  if (!entry) return null;
  const c = entry.character;
  const hair = [c.hairstyle, c.hairColor?.toLowerCase()].filter(Boolean).join(", ");
  const initials = c.name
    .split(" ")
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("");
  const b = c.backstory;

  return (
    <Modal open onClose={onClose} title="Character On Demand" size="wide">
      <div className="tool-hero">
        <div className="tool-avatar" aria-hidden>
          {initials}
        </div>
        <div className="tool-hero-text">
          <h3 className="tool-hero-name">{c.name}</h3>
          <div className="tool-tags">
            <span className="tool-tag">{c.gender}</span>
            <span className="tool-tag">{speciesLabel(c.species)}</span>
            {c.background && <span className="tool-tag tool-tag-accent">{c.background}</span>}
          </div>
        </div>
      </div>

      {(hair || c.beard || b) && (
        <div className="tool-sheet">
          {(hair || c.beard) && (
            <div className="tool-facts">
              <Fact label="Hair" value={hair} />
              <Fact label="Beard" value={c.beard} />
            </div>
          )}

          {b && (
            <div className="cod-story">
              <section>
                <h4>Appearance</h4>
                <p>{b.appearance}</p>
              </section>
              <section>
                <h4>Right now</h4>
                <p>{b.want}</p>
              </section>
              <div className="cod-story-pair">
                <section>
                  <h4>Quirk</h4>
                  <p>{b.quirk}</p>
                </section>
                <section>
                  <h4>Fear</h4>
                  <p>{b.fear}</p>
                </section>
              </div>
              <section className="cod-story-secret">
                <h4>
                  <Lock size={13} strokeWidth={2.25} aria-hidden />
                  Secret
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
          Generate another
        </button>
        {entry.personId ? (
          <>
            <span className="cod-created">
              <Check size={15} strokeWidth={2.5} aria-hidden />
              Article created
            </span>
            <Link href={`/articles?type=character&id=${encodeURIComponent(entry.personId)}`} className="btn btn-sm btn-primary">
              <ExternalLink size={15} strokeWidth={2.25} aria-hidden />
              Open article
            </Link>
          </>
        ) : (
          <button type="button" className="btn btn-sm btn-primary" onClick={() => onCreateArticle(entry)} disabled={busy !== null}>
            <FilePlus2 size={15} strokeWidth={2.25} aria-hidden />
            {busy === "create" ? "Creating…" : "Create Article from this Character"}
          </button>
        )}
      </div>
    </Modal>
  );
}
