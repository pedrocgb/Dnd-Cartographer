"use client";

import { useMemo } from "react";
import { X } from "lucide-react";
import InfoPicker from "@/components/articles/InfoPicker";
import { candidateOptions, type Candidate } from "@/components/articles/candidates";
import { LINK_ROLE_LABELS, LINK_ROLES, type LinkRole, type QuestLink } from "@/server/quests/types";
import { ArticleName } from "./parts";

/** A sensible first role for an article of this template (changeable per row). */
function defaultRole(template: string): LinkRole {
  if (["settlement", "territory", "building", "geography"].includes(template)) return "location";
  if (["item", "magic", "technology"].includes(template)) return "item";
  if (["organization", "military", "religion"].includes(template)) return "faction";
  if (template === "character" || template === "playerCharacter") return "ally";
  return "other";
}

/** Articles involved in a quest, each with its role (ally, antagonist, location…), plus a picker to add more. */
export default function QuestLinksSection({ links, candidates, onChange }: { links: QuestLink[]; candidates: Candidate[] | null; onChange: (links: QuestLink[]) => void }) {
  const linked = useMemo(() => new Set(links.map((l) => l.articleId)), [links]);
  const setRole = (id: string, role: LinkRole) => onChange(links.map((l) => (l.articleId === id ? { ...l, role } : l)));
  return (
    <div className="cel-section">
      <header className="cel-section-head">
        <div>
          <h3>Who and where</h3>
          <p className="cal-help">NPCs, places, factions and items that matter to this quest. Each one shows the quest on its article, under &ldquo;In quests&rdquo;.</p>
        </div>
      </header>
      {links.length === 0 ? (
        <p className="cel-empty">Nothing linked yet.</p>
      ) : (
        <ul className="cel-links qs-links-edit">
          {links.map((l) => (
            <li key={l.articleId} className="cel-link">
              <select aria-label="Role" value={l.role} onChange={(e) => setRole(l.articleId, e.target.value as LinkRole)}>
                {LINK_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {LINK_ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
              <ArticleName link={l} candidates={candidates} />
              <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="Unlink" data-tooltip="Unlink" onClick={() => onChange(links.filter((x) => x.articleId !== l.articleId))}>
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="cel-link-add">
        <InfoPicker
          options={candidateOptions(candidates ?? [], linked)}
          value={null}
          placeholder={candidates ? "Link an article…" : "Loading articles…"}
          ariaLabel="Link an article"
          collapsibleGroups
          disabled={!candidates}
          onChange={(id) => {
            const c = id ? candidates?.find((x) => x.id === id) : null;
            if (c) onChange([...links, { template: c.template, articleId: c.id, role: defaultRole(c.template) }]);
          }}
        />
      </div>
    </div>
  );
}
