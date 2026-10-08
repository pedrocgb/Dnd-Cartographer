"use client";

import Modal from "@/components/Modal";
import { STORY_TEMPLATES } from "@/server/writer/templates";
import { CHILD_KIND, type NodeKind } from "@/server/writer/types";
import { useT } from "@/i18n/useT";

/**
 * Pick a story structure to lay out under the campaign (`target` null:
 * arcs), an arc (chapters) or a chapter (scenes): one item per beat.
 */
export default function TemplatePicker({ target, onPick, onClose }: { target: NodeKind | null; onPick: (key: string) => void; onClose: () => void }) {
  const t = useT("writer");
  const creates = target === null ? "arc" : CHILD_KIND[target];
  return (
    <Modal open onClose={onClose} title={t("templatePicker.title")} size="wide">
      {creates && <p className="cal-help">{t(`templatePicker.adds.${creates}`)}</p>}
      <ul className="wr-templates">
        {STORY_TEMPLATES.map((s) => (
          <li key={s.key}>
            <button type="button" className="wr-template" onClick={() => onPick(s.key)}>
              <span className="wr-template-head">
                <strong>{s.name}</strong>
                <span className="cal-help">{s.source}</span>
              </span>
              <span>{s.summary}</span>
              <span className="cal-help">{t("templatePicker.bestFor", { what: s.bestFor })}</span>
              <span className="wr-template-beats" aria-label={t("templatePicker.beats", { count: s.beats.length })}>
                {s.beats.map((b) => (
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
