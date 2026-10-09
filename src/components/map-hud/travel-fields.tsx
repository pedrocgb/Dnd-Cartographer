"use client";

import { useState } from "react";
import ColorWheel from "@/components/ColorWheel";
import SegmentedControl from "@/components/marker-panel/SegmentedControl";
import Toggle from "@/components/Toggle";
import ToolSection from "@/components/ToolSection";
import { SliderField } from "@/components/GridPanel";
import { MixedTag, folderTree, type MapFolderData } from "@/components/LayerFolders";
import { formatNumber, unitSuffix, type ScaleConfig } from "@/server/scale/scale-config";
import { DEFAULT_ROUTE_STYLE, ROUTE_STYLES, ROUTE_WIDTH, type MapRouteData, type RouteStyle } from "@/server/travel/route-config";
import { DEFAULT_TRAVEL, formatDuration, milesToUnit, modeOf, PACES, TRAVEL_MODES, type TravelGroup, type TravelPlan, type TravelSettings } from "@/server/travel/travel";
import { useSettings } from "@/components/settings/SettingsProvider";
import { distanceUnit, fromFeet, fromKg, fromLitres, fromMiles, roundForInput, shortLengthUnit, speedUnit, toFeet, toMiles, volumeUnit, weightUnit } from "@/server/settings/units";
import { worldKey } from "@/components/world-key";
import { useT } from "@/i18n/useT";
import { activeT } from "@/i18n/active";
import type { MessageKey } from "@/i18n/messages";

/** A route's settings, shared by the Travel panel (a folder's default look) and the travel bar. */

const GROUPS: TravelGroup[] = ["Land", "Water", "Air"];
const DRAFT_KEY = "travel-draft";

export interface TravelDraft {
  style: RouteStyle;
  settings: TravelSettings;
}

/** The next route's look and travel settings, remembered in this browser. */
export function useTravelDraft() {
  const [draft, setDraft] = useState<TravelDraft>(() => {
    try {
      const raw = localStorage.getItem(worldKey(DRAFT_KEY));
      const parsed = raw ? JSON.parse(raw) : null;
      return { style: { ...DEFAULT_ROUTE_STYLE, ...parsed?.style }, settings: { ...DEFAULT_TRAVEL, ...parsed?.settings } };
    } catch {
      return { style: DEFAULT_ROUTE_STYLE, settings: DEFAULT_TRAVEL };
    }
  });
  const update = (patch: { style?: Partial<RouteStyle>; settings?: Partial<TravelSettings> }) =>
    setDraft((prev) => {
      const next = { style: { ...prev.style, ...patch.style }, settings: { ...prev.settings, ...patch.settings } };
      try {
        localStorage.setItem(worldKey(DRAFT_KEY), JSON.stringify(next));
      } catch {
        // Private mode or blocked storage: the draft just isn't remembered.
      }
      return next;
    });
  return [draft, update] as const;
}

/** A number field that keeps what's typed until it's a valid number in range. */
function NumberField({ id, label, value, min, max, suffix, onChange }: { id: string; label: string; value: number; min: number; max: number; suffix?: string; onChange: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  const [last, setLast] = useState(value);
  if (value !== last) {
    setLast(value);
    if (Number(text.replace(",", ".")) !== value) setText(String(value));
  }
  return (
    <div className="travel-field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <span className="travel-number">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const v = Number(e.target.value.replace(",", "."));
            if (e.target.value.trim() !== "" && v >= min && v <= max) onChange(v);
          }}
          onBlur={() => setText(String(value))}
        />
        {suffix && <span className="field-label">{suffix}</span>}
      </span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="travel-stat">
      <span className="field-label">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

/** How the route is travelled: way of travel, pace, speed, hours a day, terrain, travellers. */
export function TravelSettingsFields({ settings, config, idPrefix, onChange }: { settings: TravelSettings; config: ScaleConfig; idPrefix: string; onChange: (patch: Partial<TravelSettings>) => void }) {
  const t = useT("maps");
  const mode = modeOf(settings.mode);
  const paced = mode.fixedMph === null && mode.key !== "custom";
  const canUseCreatureSpeed = paced && mode.key !== "flying-mount" && mode.speedFt !== null && mode.key !== "foot";
  const length = useSettings().settings.lengthSystem;
  const speed = (mph: number) => `${formatNumber(fromMiles(mph, length))} ${speedUnit(length)}`;
  /** Inputs show the user's units; settings keep mph, feet and miles. */
  const milesInput = (mph: number) => roundForInput(fromMiles(mph, length));
  return (
    <>
      <ToolSection id="travel-by" title={t("travel.by")}>
        <select aria-label={t("travel.way")} value={settings.mode} onChange={(e) => onChange({ mode: e.target.value, hoursPerDay: modeOf(e.target.value).defaultHours, gallop: false })}>
          {GROUPS.map((group) => (
            <optgroup key={group} label={t(`travel.group.${group}`)}>
              {TRAVEL_MODES.filter((m) => m.group === group).map((m) => (
                <option key={m.key} value={m.key}>
                  {m.fixedMph !== null ? t("travel.modeSpeed", { mode: modeLabel(m.key), speed: speed(m.fixedMph) }) : modeLabel(m.key)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {paced && (
          <div className="travel-field">
            <span className="field-label">{t("travel.pace")}</span>
            <SegmentedControl ariaLabel={t("travel.pace")} value={settings.pace} segments={PACES.map((key) => ({ key, label: t(`travel.pace.${key}`) }))} onChange={(pace) => onChange({ pace })} />
          </div>
        )}
        {canUseCreatureSpeed && (
          <>
            <Toggle checked={settings.useCreatureSpeed} onChange={(useCreatureSpeed) => onChange({ useCreatureSpeed })} label={t("travel.creatureSpeed", { speed: `${formatNumber(fromFeet(mode.speedFt ?? 0, length))} ${shortLengthUnit(length)}` })} />
            <p className="field-label">{t("travel.creatureSpeedHint")}</p>
          </>
        )}
        {mode.key === "flying-mount" && (
          <NumberField
            id={`${idPrefix}-fly`}
            label={t("travel.flySpeed")}
            value={roundForInput(fromFeet(settings.speedFt, length))}
            min={roundForInput(fromFeet(5, length))}
            max={roundForInput(fromFeet(300, length))}
            suffix={shortLengthUnit(length)}
            onChange={(v) => onChange({ speedFt: toFeet(v, length) })}
          />
        )}
        {mode.key === "custom" && (
          <NumberField
            id={`${idPrefix}-mph`}
            label={t("travel.speed")}
            value={milesInput(settings.customMph)}
            min={milesInput(0.1)}
            max={milesInput(500)}
            suffix={speedUnit(length)}
            onChange={(v) => onChange({ customMph: toMiles(v, length) })}
          />
        )}
        {mode.group === "Water" && (
          <NumberField
            id={`${idPrefix}-current`}
            label={t("travel.current")}
            value={milesInput(settings.currentMph)}
            min={milesInput(-20)}
            max={milesInput(20)}
            suffix={speedUnit(length)}
            onChange={(v) => onChange({ currentMph: toMiles(v, length) })}
          />
        )}
      </ToolSection>
      <ToolSection id="travel-day" title={t("travel.eachDay")}>
        <SliderField label={t("travel.hours")} value={settings.hoursPerDay} min={1} max={24} suffix="h" defaultValue={mode.defaultHours} onChange={(hoursPerDay) => onChange({ hoursPerDay })} />
        {mode.mount && mode.group !== "Air" && !settings.useCreatureSpeed && (
          <Toggle checked={settings.gallop} onChange={(gallop) => onChange({ gallop })} label={t("travel.gallop", { speed: speed(8) })} />
        )}
        {!mode.ignoresTerrain && (
          <>
            <SliderField label={t("travel.rough")} value={Math.round(settings.difficultShare * 100)} min={0} max={100} suffix="%" defaultValue={0} onChange={(v) => onChange({ difficultShare: v / 100 })} />
            <p className="field-label">{t("travel.roughHint")}</p>
          </>
        )}
      </ToolSection>
      <ToolSection id="travel-supplies" title={t("travel.travellers")}>
        <NumberField id={`${idPrefix}-party`} label={t("travel.travellers")} value={settings.partySize} min={0} max={1000} onChange={(partySize) => onChange({ partySize: Math.round(partySize) })} />
        <Toggle checked={settings.hotWeather} onChange={(hotWeather) => onChange({ hotWeather })} label={t("travel.hotWeather")} />
        {config.unit === "custom" && (
          <NumberField
            id={`${idPrefix}-unit`}
            label={t("travel.customUnit", { unit: unitSuffix(config) })}
            value={roundForInput(fromMiles(settings.customUnitMiles, length))}
            min={0.01}
            max={roundForInput(fromMiles(100000, length))}
            suffix={distanceUnit(length)}
            onChange={(v) => onChange({ customUnitMiles: toMiles(v, length) })}
          />
        )}
      </ToolSection>
    </>
  );
}

const NO_MIXED: ReadonlySet<string> = new Set();

type RouteFieldsProps = { v: RouteStyle; mixed?: ReadonlySet<string>; onChange: (patch: Partial<RouteStyle>) => void };

export function RouteColorField({ v, mixed = NO_MIXED, onChange }: RouteFieldsProps) {
  const t = useT("maps");
  return (
    <>
      <span className="field-label">
        {t("travel.color")} <MixedTag show={mixed.has("color")} />
      </span>
      <ColorWheel value={v.color} mixed={mixed.has("color")} onChange={(color) => onChange({ color })} />
    </>
  );
}

export function RouteWidthField({ v, mixed = NO_MIXED, onChange }: RouteFieldsProps) {
  const t = useT("maps");
  return <SliderField label={t("travel.width")} value={v.width} mixed={mixed.has("width")} min={ROUTE_WIDTH[0]} max={ROUTE_WIDTH[1]} step={0.5} suffix="px" defaultValue={DEFAULT_ROUTE_STYLE.width} onChange={(width) => onChange({ width })} />;
}

export function RouteLineField({ v, mixed = NO_MIXED, onChange }: RouteFieldsProps) {
  const t = useT("maps");
  return (
    <div className="travel-field">
      <span className="field-label">
        {t("travel.line")} <MixedTag show={mixed.has("style")} />
      </span>
      <SegmentedControl ariaLabel={t("travel.lineStyle")} value={v.style} segments={ROUTE_STYLES.map((key) => ({ key, label: t(`travel.style.${key}`) }))} onChange={(style) => onChange({ style })} />
    </div>
  );
}

/** A route's whole look in one column: a folder's default for its new routes. */
export function RouteStyleFields(props: RouteFieldsProps) {
  return (
    <>
      <RouteColorField {...props} />
      <RouteWidthField {...props} />
      <RouteLineField {...props} />
    </>
  );
}

/** The trip: time, speed, distance per day and supplies. */
export function Journey({ plan, settings, config }: { plan: TravelPlan | null; settings: TravelSettings; config: ScaleConfig }) {
  const t = useT("maps");
  const { lengthSystem: length, weightSystem: weight } = useSettings().settings;
  const unit = unitSuffix(config);
  const distance = (miles: number) => `${formatNumber(fromMiles(miles, length))} ${distanceUnit(length)}`;
  // The map's own unit first, then the user's units when they differ.
  const inUnit = (miles: number) => (config.unit === distanceUnit(length) ? distance(miles) : `${formatNumber(milesToUnit(miles, config, settings))} ${unit} (${distance(miles)})`);
  if (!plan) return <p className="field-label">{t("travel.noMove")}</p>;
  return (
    <div className="travel-journey">
      <div className="travel-hero">
        <span className="field-label">{t("travel.time")}</span>
        <strong>{formatDuration(plan.fullDays, plan.extraHours)}</strong>
        <span className="field-label">
          {t("travel.summary", { mode: modeLabel(settings.mode), speed: `${formatNumber(fromMiles(plan.mph, length))} ${speedUnit(length)}`, hours: formatNumber(settings.hoursPerDay) })}
        </span>
      </div>
      <div className="travel-stats">
        <Stat label={t("travel.distance")} value={inUnit(plan.miles)} />
        <Stat label={t("travel.perDay")} value={inUnit(plan.milesPerDay)} />
        <Stat label={t("travel.daysOnRoad")} value={formatNumber(plan.daysOnRoad)} />
        <Stat label={t("travel.hoursTravelling")} value={formatNumber(plan.totalHours)} />
      </div>
      {plan.gallopMiles > 0 && <p className="travel-note">{t("travel.gallopNote", { distance: distance(plan.gallopMiles) })}</p>}
      {settings.partySize > 0 && (
        <div className="travel-stats">
          <Stat label={t("travel.food")} value={`${formatNumber(fromKg(plan.foodKg, weight))} ${weightUnit(weight)}`} />
          <Stat label={settings.hotWeather ? t("travel.waterHot") : t("travel.water")} value={`${formatNumber(fromLitres(plan.waterL, weight))} ${volumeUnit(weight)}`} />
        </div>
      )}
    </div>
  );
}

export const routeLabel = (route: Pick<MapRouteData, "name">, index: number) => route.name || activeT("maps")("routes.placeholderName", { n: index + 1 });

/** A route's label as the Travel panel lists it: unnamed ones are numbered within their folder. */
export function routeLabelIn(route: MapRouteData, routes: MapRouteData[], groups: MapFolderData[], activeLayerId: string): string {
  const tree = folderTree(routes, groups, activeLayerId);
  const list = route.layerId !== activeLayerId ? tree.shared : tree.itemsOf(tree.folderOf(route));
  return routeLabel(route, Math.max(0, list.findIndex((r) => r.id === route.id)));
}

/** A way of travel's name in the user's language. */
export const modeLabel = (key: string) => activeT("maps")(`travel.mode.${modeOf(key).key}` as MessageKey<"maps">);
