"use client";

import { useState } from "react";
import { X, Pencil, Check, Book, Info, Crown, Link as LinkIcon } from "lucide-react";
import DescriptionSection from "./DescriptionSection";
import MarkerIcon from "./MarkerIcon";
import { DEFAULT_MARKER_CATEGORY, markerCategoryLabel } from "@/server/markers/icon-registry";
import { markerTagLabel } from "@/server/markers/tag-registry";
import type { Marker } from "./MarkerLayer";
import type { MapLayerData } from "./layer-images";
import PoliticalReferencesPanel from "./PoliticalReferencesPanel";
import MarkerLinksPanel from "./MarkerLinksPanel";
import MarkerArticlesPanel from "./MarkerArticlesPanel";
import MarkerCard from "./marker-panel/MarkerCard";
import { MarkerSubjectEdit, MarkerSubjectView } from "./marker-panel/MarkerSubject";
import { MarkerLinkedMapEdit, MarkerLinkedMapView } from "./marker-panel/MarkerLinkedMap";
import { useMarkerArticleLinks } from "./marker-panel/use-marker-article-links";
import type { MarkerUpdate } from "./marker-panel/types";
import { useT } from "@/i18n/useT";

export type MarkerSection = "basic" | "politics" | "articles" | "links";

const SECTIONS: { key: MarkerSection; Icon: typeof Info }[] = [
  { key: "basic", Icon: Info },
  { key: "politics", Icon: Crown },
  { key: "articles", Icon: Book },
  { key: "links", Icon: LinkIcon },
];

interface MapOption {
  id: string;
  name: string;
}

/** View mode's classification chips and, apart from them, the accepted territory chain. */
function TagChips({ marker, layer, chain }: { marker: Marker; layer: MapLayerData | null; chain: { id: string; name: string }[] | null }) {
  const tm = useT("maps");
  const tags = [
    markerCategoryLabel(marker.category ?? DEFAULT_MARKER_CATEGORY),
    marker.environment && markerTagLabel("environment", marker.environment),
    marker.ownership && markerTagLabel("ownership", marker.ownership),
    ...marker.statusTags.map((s) => markerTagLabel("status", s)),
  ].filter((t): t is string => !!t);
  return (
    <div className="marker-view-tags">
      <div className="marker-chip-row">
        {tags.map((t) => (
          <span key={t} className="marker-chip">
            {t}
          </span>
        ))}
        {layer && (
          <span className="marker-chip marker-chip-muted" data-tooltip={tm("field.layer")}>
            {layer.name}
          </span>
        )}
      </div>
      {chain && chain.length > 0 && (
        <div className="politics-breadcrumb" aria-label={tm("markerPanel.territory")}>
          {chain.map((t, i) => (
            <span key={t.id}>
              {i > 0 && <span className="politics-breadcrumb-sep">›</span>}
              {t.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The marker card, docked on the map's right: the selected marker's
 * content — its name, tags, linked map, main article and description
 * (Overview), its political ties, articles and links — as tabs. Its look,
 * details and actions are in the marker bar. The pencil switches Overview
 * between reading and editing.
 */
export default function MarkerPanel({
  marker,
  maps,
  layers,
  section,
  onSectionChange,
  autoFocusName,
  startInEdit,
  onUpdate,
  onClose,
}: {
  marker: Marker;
  maps: MapOption[];
  layers: MapLayerData[];
  section: MarkerSection;
  onSectionChange: (section: MarkerSection) => void;
  autoFocusName: boolean;
  startInEdit: boolean;
  onUpdate: MarkerUpdate;
  onClose: () => void;
}) {
  const tm = useT("maps");
  // Seeded once per marker — the parent remounts this component (via key={marker.id})
  // whenever the selected marker changes, so neither of these go stale across selections.
  const [name, setName] = useState(() => marker.name);
  const [editing, setEditing] = useState(startInEdit);
  // Shared by the Main article card and the Articles tab, so a change in one shows in the other.
  const links = useMarkerArticleLinks(marker.id);

  // A right-click on an already-selected marker (see MarkerLayer's
  // contextmenu handler) asks for edit mode without changing which marker is
  // selected, so this component doesn't remount via its `key` — the initial
  // useState above only runs once, so a later startInEdit flip to true needs
  // to be caught here. Adjusting state during render (guarded by the
  // prevStartInEdit comparison) rather than in an effect, per React's own
  // guidance for deriving state from a changed prop.
  const [prevStartInEdit, setPrevStartInEdit] = useState(startInEdit);
  if (startInEdit !== prevStartInEdit) {
    setPrevStartInEdit(startInEdit);
    if (startInEdit) setEditing(true);
  }
  const linkedMap = marker.linkedMapId ? (maps.find((m) => m.id === marker.linkedMapId) ?? null) : null;
  const layer = layers.find((l) => l.id === marker.layerId) ?? null;

  // View-mode summary only shows the accepted (not draft) chain, root-first
  // (Empire -> Kingdom -> ... ). Fed by PoliticalReferencesPanel's own fetch
  // (it's always mounted, just hidden, so that data is already being loaded)
  // rather than issuing a second, duplicate /affiliation request here.
  const [affiliationChain, setAffiliationChain] = useState<{ id: string; name: string }[] | null>(null);

  function rename(next: string) {
    setName(next);
    onUpdate({ name: next });
  }

  return (
    <div className="marker-side-panel marker-card-panel">
      <div className="marker-side-panel-header">
        {editing ? (
          <input
            type="text"
            value={name}
            aria-label={tm("markerPanel.nameAria")}
            autoFocus={autoFocusName}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && name !== marker.name && onUpdate({ name })}
          />
        ) : (
          <div className="marker-view-title">
            <MarkerIcon
              iconKey={marker.iconKey}
              color={marker.color}
              backgroundColor={marker.backgroundColor}
              outlineColor={marker.outlineColor}
              backgroundShape={marker.backgroundShape}
              size={16}
            />
            <h2>{marker.name}</h2>
          </div>
        )}
        <button
          type="button"
          className={editing ? "btn btn-ghost btn-icon active" : "btn btn-ghost btn-icon"}
          aria-pressed={editing}
          aria-label={editing ? tm("markerCard.doneEditing") : tm("markerPanel.edit")}
          data-tooltip={editing ? tm("markerCard.doneEditing") : tm("markerCard.editHint")}
          onClick={() => {
            if (editing && name.trim() && name !== marker.name) onUpdate({ name });
            setEditing((e) => !e);
          }}
        >
          {editing ? <Check size={16} strokeWidth={2.25} /> : <Pencil size={16} strokeWidth={2.25} />}
        </button>
        <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label={tm("markerPanel.close")}>
          <X size={16} strokeWidth={2.25} />
        </button>
      </div>

      <div className="marker-card-tabs" role="tablist" aria-label={tm("markerPanel.sections")}>
        {SECTIONS.map(({ key, Icon }) => {
          const label = tm(`markerPanel.section.${key}`);
          return (
            <button key={key} type="button" role="tab" aria-selected={section === key} className={section === key ? "marker-card-tab active" : "marker-card-tab"} onClick={() => onSectionChange(key)}>
              <Icon size={14} strokeWidth={2.25} aria-hidden />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* All four sections stay mounted and are only hidden via CSS when
          inactive — never conditionally rendered — for the same reason
          MarkerCard's body does: an unmount/remount would drop
          Basic Information's in-progress edits (name draft, editing mode)
          and would refetch Politics/Links from scratch on every switch.
          Within Basic Information, Description keeps its slot in both
          modes (the conditional siblings around it hold their positions). */}
      <div className={section === "basic" ? "marker-section-body" : "marker-section-body marker-section-body-hidden"}>
        {editing ? null : <TagChips marker={marker} layer={layer} chain={affiliationChain} />}
        {editing ? (
          <>
            <MarkerLinkedMapEdit marker={marker} maps={maps} onUpdate={onUpdate} />
            <MarkerSubjectEdit marker={{ ...marker, name }} links={links} onUpdate={onUpdate} onRename={rename} />
          </>
        ) : (
          <>
            <MarkerLinkedMapView map={linkedMap} />
            <MarkerSubjectView markerId={marker.id} links={links} />
          </>
        )}

        <MarkerCard title={tm("markerPanel.description")} bare={!editing}>
          <DescriptionSection
            documentId={marker.descriptionDocumentId}
            editable={editing}
            onDocumentCreated={(id) => onUpdate({ descriptionDocumentId: id })}
          />
        </MarkerCard>

      </div>

      <div className={section === "politics" ? "marker-section-body" : "marker-section-body marker-section-body-hidden"}>
        <PoliticalReferencesPanel
          markerId={marker.id}
          onAcceptedChainChange={(chain) => setAffiliationChain(chain)}
        />
      </div>

      <div className={section === "articles" ? "marker-section-body" : "marker-section-body marker-section-body-hidden"}>
        <MarkerArticlesPanel links={links} markerName={name.trim() || marker.name} />
      </div>
      <div className={section === "links" ? "marker-section-body" : "marker-section-body marker-section-body-hidden"}>
        <MarkerLinksPanel markerId={marker.id} />
      </div>
    </div>
  );
}
