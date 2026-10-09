"use client";

import { useState } from "react";
import { Check, Copy, Eye, Link as LinkIcon, Lock, MapPin, MousePointer2, Tags, Trash2, Unlock, X } from "lucide-react";
import MarkerIcon, { RawIcon, ShapeSilhouette } from "../MarkerIcon";
import IconPicker from "../IconPicker";
import ColorWheel from "../ColorWheel";
import SegmentedControl from "../marker-panel/SegmentedControl";
import MarkerDetails from "../marker-panel/MarkerDetails";
import { IconFilter } from "../MarkersPanel";
import type { Marker } from "../MarkerLayer";
import type { MapLayerData } from "../layer-images";
import type { MarkerPatch, MarkerUpdate } from "../marker-panel/types";
import { BACKGROUND_SHAPES, ICONS, IMPORTANCE_LEVELS, LABEL_MODES, iconLabel } from "@/server/markers/icon-registry";
import { formatInteger } from "@/server/settings/number-format";
import { useT } from "@/i18n/useT";
import type { MessageKey } from "@/i18n/messages";
import { DoneButton, ToolBar, ToolBarButton, ToolBarDivider, ToolBarPopover } from "./ToolBar";

type ColorTarget = "color" | "backgroundColor" | "outlineColor";

const COLOR_TARGETS: { key: ColorTarget; label: MessageKey<"maps"> }[] = [
  { key: "color", label: "legend.icon" },
  { key: "backgroundColor", label: "zones.fill" },
  { key: "outlineColor", label: "zones.outline" },
];

const colorPatch = (target: ColorTarget, hex: string): MarkerPatch => (target === "backgroundColor" ? { backgroundColor: hex } : target === "outlineColor" ? { outlineColor: hex } : { color: hex });

interface IconFilterApi {
  selected: Set<string>;
  allOn: boolean;
  toggle: (iconKey: string) => void;
  selectAll: () => void;
  clearAll: () => void;
}

/**
 * The Markers bar: select, place a marker (one click on the map, with the
 * last look used), and which icons the map shows. With a marker selected:
 * its icon, shape, colors, size and label, its details (category, tags,
 * layers), then lock, duplicate, copy link, delete and Done. Its content
 * (article, description, politics, links) is in the marker card.
 */
export default function MarkerToolBar({
  inset,
  toolOpen,
  adding,
  placingName,
  onToggleAdding,
  iconFilter,
  marker,
  layers,
  onUpdate,
  onDuplicate,
  onDelete,
  onDeselect,
  onClose,
}: {
  /** Where the map's free part starts (right of the side panel). */
  inset: number;
  /** The Markers tool is open (its list beside the map). */
  toolOpen: boolean;
  adding: boolean;
  /** The article being placed, if the placement came from one. */
  placingName: string | null;
  onToggleAdding: () => void;
  iconFilter: IconFilterApi;
  /** The selected marker. */
  marker: Marker | null;
  layers: MapLayerData[];
  onUpdate: MarkerUpdate;
  onDuplicate: () => void;
  onDelete: () => void;
  onDeselect: () => void;
  onClose: () => void;
}) {
  const t = useT("maps");
  const tc = useT("common");
  const shownIcons = iconFilter.allOn ? ICONS.length : iconFilter.selected.size;
  const caption = adding ? (placingName ? t("toolbar.clickToPlace", { name: placingName }) : t("toolbar.clickMap")) : marker?.locked ? t("markerBar.locked") : undefined;

  return (
    <ToolBar label={t("markerBar.label")} inset={inset} caption={caption}>
      <ToolBarButton Icon={MousePointer2} label={t("markerBar.select")} hint={t("markerBar.selectHint")} pressed={!adding} onClick={() => adding && onToggleAdding()} />
      <ToolBarButton Icon={MapPin} label={t("toolbar.addMarker")} hint={t("markerBar.placeHint")} pressed={adding} onClick={onToggleAdding} />
      <ToolBarDivider />
      <ToolBarPopover
        label={t("markerBar.shownIcons")}
        hint={t("markers.iconHint")}
        wide
        face={
          <>
            <Eye size={16} strokeWidth={2.25} aria-hidden />
            <span className="tool-bar-value">{iconFilter.allOn ? t("markers.all") : t("markers.groupShown", { shown: formatInteger(shownIcons), total: formatInteger(ICONS.length) })}</span>
          </>
        }
      >
        <div className="tool-bar-pop-fields markers-panel-filter">
          <IconFilter selected={iconFilter.selected} allOn={iconFilter.allOn} onToggle={iconFilter.toggle} onSelectAll={iconFilter.selectAll} onClearAll={iconFilter.clearAll} />
        </div>
      </ToolBarPopover>

      {marker && (
        <>
          <ToolBarDivider />
          <span className="tool-bar-label">
            <MarkerIcon iconKey={marker.iconKey} color={marker.color} backgroundColor={marker.backgroundColor} outlineColor={marker.outlineColor} backgroundShape={marker.backgroundShape} size={16} />
            <span className="tool-bar-text">{marker.name}</span>
          </span>
          <MarkerLook marker={marker} layers={layers} onUpdate={onUpdate} />
          <ToolBarDivider />
          <ToolBarButton
            Icon={marker.locked ? Lock : Unlock}
            label={marker.locked ? t("markerPanel.unlock") : t("markerPanel.lock")}
            pressed={marker.locked}
            onClick={() => onUpdate({ locked: !marker.locked })}
          />
          <ToolBarButton Icon={Copy} label={t("markerPanel.duplicate")} onClick={onDuplicate} />
          <CopyLinkButton markerId={marker.id} />
          <ToolBarButton Icon={Trash2} danger label={tc("delete")} hint={t("markerBar.deleteHint")} disabled={marker.locked} onClick={onDelete} />
          <DoneButton onClick={onDeselect} />
        </>
      )}
      {toolOpen && !marker && (
        <>
          <ToolBarDivider />
          <ToolBarButton Icon={X} label={t("markers.close")} onClick={onClose} />
        </>
      )}
    </ToolBar>
  );
}

/** Copies the marker's link (the map opened on it); a check confirms for a moment. */
function CopyLinkButton({ markerId }: { markerId: string }) {
  const t = useT("maps");
  const [copied, setCopied] = useState(false);
  function copy() {
    const target = `${window.location.origin}${window.location.pathname}?marker=${markerId}`;
    void navigator.clipboard.writeText(target).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return <ToolBarButton Icon={copied ? Check : LinkIcon} label={copied ? t("markerPanel.copied") : t("markerPanel.copyLink")} onClick={copy} />;
}

/** Icon, shape, colors, size and label, and the details: the selected marker's look and classification. */
function MarkerLook({ marker, layers, onUpdate }: { marker: Marker; layers: MapLayerData[]; onUpdate: MarkerUpdate }) {
  const t = useT("maps");
  const ti = useT("icons");
  const [target, setTarget] = useState<ColorTarget>("color");
  const bare = marker.backgroundShape === "none";
  const colorTarget = bare ? "color" : target;
  const shape = BACKGROUND_SHAPES.find((s) => s.key === marker.backgroundShape) ?? BACKGROUND_SHAPES[0];
  const importance = IMPORTANCE_LEVELS.find((l) => l.key === marker.importance) ?? IMPORTANCE_LEVELS[0];
  return (
    <>
      <ToolBarPopover label={ti("icon.fallback")} hint={iconLabel(marker.iconKey)} wide face={<RawIcon iconKey={marker.iconKey} size={16} aria-hidden />}>
        <div className="tool-bar-pop-fields">
          <IconPicker value={marker.iconKey} onChange={(iconKey) => onUpdate({ iconKey })} />
        </div>
      </ToolBarPopover>
      <ToolBarPopover label={t("area.shape")} hint={ti(`shape.${shape.key}`)} face={<ShapeSilhouette shape={marker.backgroundShape} size={16} />}>
        {(close) => (
          <ul className="tool-bar-choices">
            {BACKGROUND_SHAPES.map((s) => (
              <li key={s.key}>
                <button
                  type="button"
                  aria-pressed={s.key === marker.backgroundShape}
                  onClick={() => {
                    onUpdate({ backgroundShape: s.key });
                    close();
                  }}
                >
                  <ShapeSilhouette shape={s.key} size={16} />
                  <span className="tool-bar-text">{ti(`shape.${s.key}`)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </ToolBarPopover>
      <ToolBarPopover
        label={t("markerBar.colors")}
        hint={t("markerBar.colorsHint")}
        face={
          <span className="tool-bar-swatches" aria-hidden>
            <span className="tool-bar-swatch" style={{ background: marker.color }} />
            {!bare && <span className="tool-bar-swatch" style={{ background: marker.backgroundColor }} />}
            {!bare && <span className="tool-bar-swatch ring" style={{ borderColor: marker.outlineColor }} />}
          </span>
        }
      >
        <div className="tool-bar-pop-fields">
          {!bare && (
            <SegmentedControl
              ariaLabel={t("markerBar.colors")}
              value={colorTarget}
              onChange={setTarget}
              segments={COLOR_TARGETS.map((c) => ({ key: c.key, label: t(c.label), icon: <span className="tool-bar-swatch" style={{ background: marker[c.key] }} /> }))}
            />
          )}
          <ColorWheel key={colorTarget} value={marker[colorTarget]} onChange={(hex) => onUpdate(colorPatch(colorTarget, hex))} />
        </div>
      </ToolBarPopover>
      <ToolBarPopover label={t("markerBar.display")} hint={t("markerBar.displayHint")} face={<span className="tool-bar-value">{ti(`importance.${importance.key}`)}</span>}>
        <div className="tool-bar-pop-fields">
          <span className="field-label">{t("style.size")}</span>
          <SegmentedControl ariaLabel={t("style.size")} value={marker.importance} onChange={(v) => onUpdate({ importance: v })} segments={IMPORTANCE_LEVELS.map((l) => ({ key: l.key, label: ti(`importance.${l.key}`) }))} />
          <span className="field-label">{t("marker.labelRow")}</span>
          <SegmentedControl
            ariaLabel={t("marker.nameOnMap")}
            value={marker.labelMode}
            onChange={(labelMode) => onUpdate({ labelMode })}
            segments={LABEL_MODES.map((m) => ({ key: m.key, label: m.key === "hover" ? t("marker.labelHover") : ti(`labelMode.${m.key}`) }))}
          />
        </div>
      </ToolBarPopover>
      <ToolBarPopover label={t("marker.details")} hint={t("markerBar.detailsHint")} wide face={<Tags size={16} strokeWidth={2.25} aria-hidden />}>
        <div className="tool-bar-pop-fields">
          <MarkerDetails marker={marker} layers={layers} onUpdate={onUpdate} />
        </div>
      </ToolBarPopover>
    </>
  );
}
