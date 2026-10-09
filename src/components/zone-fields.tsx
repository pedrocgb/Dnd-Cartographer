"use client";

import { formatDecimal } from "@/server/settings/number-format";
import { useEffect, useMemo, useState } from "react";
import { Brush, Circle, Crown, Hexagon, Square } from "lucide-react";
import { Skeleton, SkeletonRegion } from "./Skeleton";
import { AreaReadings } from "./map-hud/area-readings";
import { shapeAreaPx, shapePerimeterPx, zoneAreaShape } from "@/server/scale/area";
import type { ScaleConfig } from "@/server/scale/scale-config";
import ColorWheel from "./ColorWheel";
import { MixedTag } from "./LayerFolders";
import ToolSection from "./ToolSection";
import { buildTerritoryTree, TerritoryTreeRow } from "./TerritoryTree";
import { territoryTypeLabel } from "@/server/politics/hierarchy-config";
import { articleHref } from "@/server/articles/templates";
import type { ZoneData } from "./ZoneLayer";
import { useT } from "@/i18n/useT";

/** A zone's settings, shared by the Zones panel (a region's default style) and the zone bar. */
async function json<T>(res: Response): Promise<T> {
  return res.json();
}

export const SHAPE_ICON = { rectangle: Square, circle: Circle, polygon: Hexagon, area: Brush } as const;

interface Territory {
  id: string;
  name: string;
  type: string;
  parentId: string | null;
}

function TerritoryLinkPicker({ onPick, onCancel }: { onPick: (id: string) => void; onCancel: () => void }) {
  const t = useT("maps");
  const tc = useT("common");
  const [q, setQ] = useState("");
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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
      <input type="text" placeholder={t("zones.territory.search")} value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="politics-list politics-tree">
        {searching
          ? searchResults.map((t) => (
              <li key={t.id} className="politics-list-row">
                <button type="button" className="politics-list-pick" onClick={() => onPick(t.id)}>
                  {t.name} <span className="field-label">({territoryTypeLabel(t.type)})</span>
                </button>
              </li>
            ))
          : tree.map((root) => (
              <TerritoryTreeRow key={root.id} node={root} depth={0} expanded={expanded} onToggleExpand={toggleExpand} onSelect={onPick} />
            ))}
      </ul>
      <button className="btn btn-sm" onClick={onCancel}>
        {tc("cancel")}
      </button>
    </div>
  );
}

/** `mixed`: several zones linked to different territories (or some to none). */
export function ZoneTerritoryLink({ zone, mixed = false, onUpdate }: { zone: ZoneData; mixed?: boolean; onUpdate: (patch: Partial<ZoneData>) => void }) {
  const t = useT("maps");
  const [picking, setPicking] = useState(false);
  const [chain, setChain] = useState<Territory[] | null>(null);
  // Tracks which territoryId `chain` was actually loaded for, so a stale
  // response (or the id simply changing/clearing) can't show outdated data —
  // computed at render time below instead of an eager reset inside the effect.
  const [chainLoadedFor, setChainLoadedFor] = useState<string | null>(null);

  useEffect(() => {
    if (!zone.territoryId) return;
    let cancelled = false;
    fetch(`/api/politics/territories/${zone.territoryId}?withChain=true`)
      .then((r) => json<{ chain?: Territory[] }>(r))
      .then((d) => {
        if (cancelled) return;
        setChain(d.chain ?? null);
        setChainLoadedFor(zone.territoryId);
      })
      .catch(() => {
        if (cancelled) return;
        setChain(null);
        setChainLoadedFor(zone.territoryId);
      });
    return () => {
      cancelled = true;
    };
  }, [zone.territoryId]);

  const chainLoading = chainLoadedFor !== zone.territoryId;
  const visibleChain = chainLoading ? null : chain;

  return (
    <div className="zone-territory-link">
      <span className="field-label">
        {t("zones.territory.label")} <MixedTag show={mixed} />
      </span>
      {mixed && !picking ? (
        <div className="zone-territory-chain">
          <span className="field-label">{t("zones.territory.mixed")}</span>
          <div className="marker-panel-actions">
            <button className="btn btn-sm" onClick={() => setPicking(true)}>
              <Crown size={13} strokeWidth={2.25} />
              {t("zones.territory.linkAll")}
            </button>
            <button className="btn btn-sm" onClick={() => onUpdate({ territoryId: null })}>
              {t("zones.territory.removeAll")}
            </button>
          </div>
        </div>
      ) : zone.territoryId && !picking ? (
        <div className="zone-territory-chain">
          {chainLoading ? (
            <SkeletonRegion label={t("zones.territory.loading")}>
              <Skeleton width="70%" />
            </SkeletonRegion>
          ) : visibleChain === null ? (
            <span className="field-label">{t("zones.territory.unavailable")}</span>
          ) : (
            <span>
              {visibleChain.map((t, i) => (
                <span key={t.id}>
                  {i > 0 && " › "}
                  {t.name} <span className="field-label">({territoryTypeLabel(t.type)})</span>
                </span>
              ))}
            </span>
          )}
          <div className="marker-panel-actions">
            <a href={articleHref("territory", zone.territoryId)} target="_blank" rel="noopener noreferrer" className="btn btn-sm">
              {t("zones.territory.openProfile")}
            </a>
            <button className="btn btn-sm" onClick={() => onUpdate({ territoryId: null })}>
              {t("zones.territory.removeLink")}
            </button>
          </div>
        </div>
      ) : picking ? (
        <TerritoryLinkPicker
          onPick={(id) => {
            onUpdate({ territoryId: id });
            setPicking(false);
          }}
          onCancel={() => setPicking(false)}
        />
      ) : (
        <button className="btn btn-sm" onClick={() => setPicking(true)}>
          <Crown size={13} strokeWidth={2.25} />
          {t("zones.territory.link")}
        </button>
      )}
    </div>
  );
}

export type ZoneStyle = Pick<ZoneData, "fillColor" | "fillOpacity" | "strokeColor" | "strokeOpacity" | "strokeWidth">;

const NO_MIXED: ReadonlySet<string> = new Set();

type StyleFieldsProps = { v: ZoneStyle; mixed?: ReadonlySet<string>; onChange: (patch: Partial<ZoneStyle>) => void };

/** An opacity's value, or "Mixed" when the edited zones differ. */
function Percent({ value, mixed }: { value: number; mixed: boolean }) {
  const t = useT("maps");
  return mixed ? <span className="mixed-tag">{t("layerFolders.mixed")}</span> : <>{`${Math.round(value * 100)}%`}</>;
}

export function ZoneFillFields({ v, mixed = NO_MIXED, onChange }: StyleFieldsProps) {
  const t = useT("maps");
  return (
    <>
      <span className="field-label">
        {t("zones.fillColor")} <MixedTag show={mixed.has("fillColor")} />
      </span>
      <ColorWheel value={v.fillColor} mixed={mixed.has("fillColor")} onChange={(fillColor) => onChange({ fillColor })} />
      <label className="grid-field">
        <div className="grid-field-header">
          <span className="field-label">{t("zones.fillOpacity")}</span>
          <span className="grid-field-value"><Percent value={v.fillOpacity} mixed={mixed.has("fillOpacity")} /></span>
        </div>
        <input type="range" min={0} max={100} value={Math.round(v.fillOpacity * 100)} onChange={(e) => onChange({ fillOpacity: Number(e.target.value) / 100 })} />
      </label>
    </>
  );
}

export function ZoneOutlineFields({ v, mixed = NO_MIXED, onChange }: StyleFieldsProps) {
  const t = useT("maps");
  const m = (key: keyof ZoneStyle) => mixed.has(key);
  return (
    <>
      <span className="field-label">
        {t("zones.outlineColor")} <MixedTag show={m("strokeColor")} />
      </span>
      <ColorWheel value={v.strokeColor} mixed={m("strokeColor")} onChange={(strokeColor) => onChange({ strokeColor })} />
      <label className="grid-field">
        <div className="grid-field-header">
          <span className="field-label">{t("zones.outlineOpacity")}</span>
          <span className="grid-field-value"><Percent value={v.strokeOpacity} mixed={m("strokeOpacity")} /></span>
        </div>
        <input type="range" min={0} max={100} value={Math.round(v.strokeOpacity * 100)} onChange={(e) => onChange({ strokeOpacity: Number(e.target.value) / 100 })} />
      </label>
      <label className="grid-field">
        <div className="grid-field-header">
          <span className="field-label">{t("zones.outlineWidth")}</span>
          <span className="grid-field-value">{m("strokeWidth") ? <span className="mixed-tag">{t("layerFolders.mixed")}</span> : formatDecimal(v.strokeWidth, { minimumFractionDigits: 2 })}</span>
        </div>
        <input type="range" min={0} max={2} step={0.05} value={v.strokeWidth} onChange={(e) => onChange({ strokeWidth: Number(e.target.value) })} />
      </label>
    </>
  );
}

/** Fill and outline together: a region's default style for its new zones. */
export function ZoneStyleFields(props: StyleFieldsProps) {
  return (
    <>
      <ZoneFillFields {...props} />
      <ZoneOutlineFields {...props} />
    </>
  );
}

/**
 * A zone's area (several zones: their total), live from its borders and the
 * map's scale, so it's never out of date after a reshape or recalibration.
 */
export function ZoneArea({ zones, config }: { zones: ZoneData[]; config: ScaleConfig | null }) {
  const t = useT("maps");
  const shapes = zones.flatMap((z) => zoneAreaShape(z.shapeType, z.geometry) ?? []);
  const areaPx = shapes.reduce((sum, s) => sum + shapeAreaPx(s), 0);
  return (
    <ToolSection id="zone-area" title={zones.length > 1 ? t("zones.area.total") : t("zones.area.one")}>
      {!config ? (
        <Skeleton width="60%" />
      ) : config.framePxPerUnit === null ? (
        <p className="field-label">{zones.length > 1 ? t("zones.area.calibrateMany") : t("zones.area.calibrateOne")}</p>
      ) : (
        <AreaReadings areaPx={areaPx} perimeterPx={shapes.length === 1 ? shapePerimeterPx(shapes[0]) : undefined} config={config} />
      )}
    </ToolSection>
  );
}
