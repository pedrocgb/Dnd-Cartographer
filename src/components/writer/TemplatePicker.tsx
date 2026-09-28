"use client";

import Modal from "@/components/Modal";
import { STORY_TEMPLATES } from "@/server/writer/templates";
import { CHILD_KIND, NODE_KIND_LABELS, type NodeKind } from "@/server/writer/types";

/**
 * Pick a story structure to lay out under the campaign (`target` null:
 * arcs), an arc (chapters) or a chapter (scenes): one item per beat.
 */
export default function TemplatePicker({ target, onPick, onClose }: { target: NodeKind | null; onPick: (key: string) => void; onClose: () => void }) {
  const creates = target === null ? "arc" : CHILD_KIND[target];
  return (
    <Modal open onClose={onClose} title="Use a story structure" size="wide">
      <p className="cal-help">
        Adds one {creates ? NODE_KIND_LABELS[creates].toLowerCase() : "item"} per beat, after anything already there. Each comes with a hint of what belongs in it; rename, move or delete them freely.
      </p>
      <ul className="wr-templates">
        {STORY_TEMPLATES.map((t) => (
          <li key={t.key}>
            <button type="button" className="wr-template" onClick={() => onPick(t.key)}>
              <span className="wr-template-head">
                <strong>{t.name}</strong>
                <span className="cal-help">{t.source}</span>
              </span>
              <span>{t.summary}</span>
              <span className="cal-help">Best for: {t.bestFor}</span>
              <span className="wr-template-beats" aria-label={`${t.beats.length} beats`}>
                {t.beats.map((b) => (
                  <span key={b.key} className="wr-template-beat" data-tooltip={b.hint}>
                    {b.name}
                  </span>
                ))}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
