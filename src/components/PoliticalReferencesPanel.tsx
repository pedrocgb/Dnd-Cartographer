"use client";

import { useEffect, useMemo, useState } from "react";
import { Trash2, Search } from "lucide-react";
import { buildTerritoryTree, TerritoryTreeRow } from "@/components/TerritoryTree";
import { articleHref } from "@/server/articles/templates";
import { SkeletonList } from "@/components/Skeleton";
import { useT } from "@/i18n/useT";
import { authorityRoleLabel, territoryTypeLabel } from "@/server/politics/hierarchy-config";

interface Territory {
  id: string;
  name: string;
  type: string;
  hierarchyProfileId: string;
  parentId: string | null;
  deletedAt: string | null;
}

interface Authority {
  id: string;
  territoryId: string;
  holderType: "person" | "organization";
  holderId: string;
  role: string;
  title: string;
  /** Resolved server-side; rows arrive sorted root → leaf, then by holder name. */
  holderName: string;
}

interface AffiliationDetail {
  territoryId: string;
  status: "accepted" | "draft";
  chain: Territory[];
  missingRequiredTypes: string[];
  authorities: Authority[];
}

async function json<T>(res: Response): Promise<T> {
  return res.json();
}

function AuthorityRow({ authority, territoryName }: { authority: Authority; territoryName: string }) {
  const t = useT("politics");
  // The role is bold, so the sentence is split around it.
  const [before, after] = t(authority.title ? "affiliation.authorityTitled" : "affiliation.authority", {
    title: authority.title,
    territory: territoryName,
    holder: authority.holderName,
  }).split("{role}");
  return (
    <li className="politics-list-row">
      <span>
        {before}
        <strong>{authorityRoleLabel(authority.role, t)}</strong>
        {after}
      </span>
      <a href={articleHref(authority.holderType, authority.holderId)} target="_blank" rel="noopener noreferrer" className="btn btn-sm">
        {t("view")}
      </a>
    </li>
  );
}

function TerritoryPicker({ onPick }: { onPick: (territoryId: string) => void }) {
  const tp = useT("politics");
  const [q, setQ] = useState("");
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Fetch the full, unfiltered set once so parent/child relationships can be
  // rendered as a tree — a name-filtered fetch can return a child without
  // its ancestors, which breaks indentation. Search instead falls back to a
  // flat, client-side filtered match list (same pattern as the Politics
  // management page's territory tree).
  useEffect(() => {
    fetch("/api/politics/territories")
      .then((r) => json<{ territories: Territory[] }>(r))
      .then((d) => setTerritories(d.territories));
  }, []);

  const tree = useMemo(() => buildTerritoryTree(territories), [territories]);
  const searching = q.trim().length > 0;
  const searchResults = useMemo(() => {
    if (!searching) return [];
    const needle = q.trim().toLowerCase();
    return territories.filter((t) => t.name.toLowerCase().includes(needle));
  }, [searching, q, territories]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="politics-picker">
      <div className="politics-picker-search">
        <Search size={14} strokeWidth={2.25} />
        <input
          type="text"
          placeholder={tp("picker.search")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <ul className="politics-list politics-tree">
        {searching
          ? searchResults.map((t) => (
              <li key={t.id} className="politics-list-row">
                <button type="button" className="politics-list-pick" onClick={() => onPick(t.id)}>
                  {t.name} <span className="field-label">({territoryTypeLabel(t.type, tp)})</span>
                </button>
              </li>
            ))
          : tree.map((root) => (
              <TerritoryTreeRow key={root.id} node={root} depth={0} expanded={expanded} onToggleExpand={toggleExpand} onSelect={onPick} />
            ))}
        {searching && searchResults.length === 0 && <li className="field-label">{tp("picker.noMatches")}</li>}
      </ul>
      <a href={articleHref("territory")} target="_blank" rel="noopener noreferrer" className="btn btn-sm">
        {tp("picker.create")}
      </a>
    </div>
  );
}

export default function PoliticalReferencesPanel({
  markerId,
  onAcceptedChainChange,
}: {
  markerId: string;
  /** Reports the accepted chain (or null) after every load/refresh, so the
   * Basic Information summary can show it without a second, duplicate
   * /affiliation fetch of its own. */
  onAcceptedChainChange?: (chain: { id: string; name: string }[] | null) => void;
}) {
  const t = useT("politics");
  const tc = useT("common");
  const [accepted, setAccepted] = useState<AffiliationDetail | null>(null);
  const [draft, setDraft] = useState<AffiliationDetail | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  function refresh() {
    fetch(`/api/markers/${markerId}/affiliation`)
      .then((r) => json<{ accepted: AffiliationDetail | null; draft: AffiliationDetail | null }>(r))
      .then((d) => {
        setAccepted(d.accepted);
        setDraft(d.draft);
        setLoaded(true);
        onAcceptedChainChange?.(d.accepted?.chain ?? null);
      });
  }

  // This panel is always mounted (just hidden via CSS when another section
  // is active — see MarkerPanel), so a mount-time fetch already has the
  // data ready before the user ever switches to this tab. Re-running on
  // every `active` flip was a second, redundant round trip on every section
  // switch; mutations below already call refresh() themselves when needed.
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markerId]);

  async function putAffiliation(territoryId: string, status: "accepted" | "draft") {
    const res = await fetch(`/api/markers/${markerId}/affiliation`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ territoryId, status }),
    });
    return res;
  }

  // A picked territory is accepted outright when the server considers it a
  // complete, attachable chain; anything short of that (incomplete
  // ancestry, or a non-attachable level like a bare Duchy) is saved as an
  // explicit draft instead of failing silently or forcing extra clicks.
  async function pickTerritory(territoryId: string) {
    const acceptRes = await putAffiliation(territoryId, "accepted");
    if (acceptRes.ok) {
      setPickerOpen(false);
      refresh();
      return;
    }
    const draftRes = await putAffiliation(territoryId, "draft");
    if (!draftRes.ok) {
      const data = await draftRes.json();
      window.alert(data.error ?? t("affiliation.setFailed"));
      return;
    }
    setPickerOpen(false);
    refresh();
  }

  async function removeAffiliation(status: "accepted" | "draft") {
    await fetch(`/api/markers/${markerId}/affiliation?status=${status}`, { method: "DELETE" });
    refresh();
  }

  if (!loaded) return <SkeletonList rows={3} label={tc("loading")} />;

  return (
    <div className="politics-panel">
      <h3 className="marker-section-title">{t("affiliation.title")}</h3>
      {accepted ? (
        <div className="politics-chain">
          {accepted.chain.map((c, i) => (
            <span key={c.id}>
              {i > 0 && " › "}
              <a href={articleHref("territory", c.id)} target="_blank" rel="noopener noreferrer">
                {c.name} <span className="field-label">({territoryTypeLabel(c.type, t)})</span>
              </a>
            </span>
          ))}
          <button type="button" className="btn btn-sm btn-danger" onClick={() => removeAffiliation("accepted")}>
            <Trash2 size={13} strokeWidth={2.25} />
            {t("affiliation.remove")}
          </button>
        </div>
      ) : (
        <p className="field-label">{t("affiliation.none")}</p>
      )}

      {draft && (
        <div className="politics-draft-banner">
          <strong>{t("affiliation.draft")}</strong>{" "}
          {draft.chain.map((c) => t("nameWithType", { name: c.name, type: territoryTypeLabel(c.type, t) })).join(" › ") || t("affiliation.draftEmpty")}
          {draft.missingRequiredTypes.length > 0 && (
            <>
              {" "}
              {t("affiliation.missing", { types: draft.missingRequiredTypes.map((type) => territoryTypeLabel(type, t)).join(", ") })}
            </>
          )}
          <div className="marker-panel-actions">
            <button
              type="button"
              className="btn btn-sm btn-primary"
              disabled={draft.missingRequiredTypes.length > 0}
              onClick={async () => {
                const res = await putAffiliation(draft.chain[draft.chain.length - 1].id, "accepted");
                if (!res.ok) {
                  const data = await res.json();
                  window.alert(data.error ?? t("affiliation.acceptFailed"));
                  return;
                }
                refresh();
              }}
            >
              {t("affiliation.accept")}
            </button>
            <button type="button" className="btn btn-sm" onClick={() => removeAffiliation("draft")}>
              {t("affiliation.discard")}
            </button>
          </div>
        </div>
      )}

      {pickerOpen ? (
        <TerritoryPicker onPick={pickTerritory} />
      ) : (
        <button type="button" className="btn btn-sm" onClick={() => setPickerOpen(true)}>
          {accepted ? t("affiliation.change") : t("affiliation.set")}
        </button>
      )}

      {accepted && accepted.authorities.length > 0 && (
        <>
          <h3 className="marker-section-title">{t("affiliation.authorities")}</h3>
          <ul className="politics-list">
            {accepted.authorities.map((a) => (
              <AuthorityRow key={a.id} authority={a} territoryName={accepted.chain.find((c) => c.id === a.territoryId)?.name ?? ""} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
