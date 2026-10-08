"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarCheck, CalendarPlus, CloudSun, Dices } from "lucide-react";
import InfoPicker from "@/components/articles/InfoPicker";
import { useSettings } from "@/components/settings/SettingsProvider";
import { SettingRow } from "@/components/settings/parts";
import { fromCelsius, temperatureSymbol, toCelsius } from "@/server/settings/units";
import { generateWeatherDay, hourLabel } from "@/lib/weather/generate";
import type { WeatherEntry } from "@/lib/weather/history";
import { dayLabel } from "@/components/calendars/evaluate";
import { useDefaultCalendar } from "@/components/relations/use-default-calendar";
import { CLIMATES, DEFAULT_WEATHER_OPTIONS, GEOGRAPHY_NAMES, SEASONS, type WeatherOptions } from "@/lib/weather/options";
import RecentList from "./RecentList";
import AttachWeatherModal from "./AttachWeatherModal";
import { useWeatherHistory } from "./useWeatherHistory";
import WeatherModal from "./WeatherModal";
import { useT } from "@/i18n/useT";
import { climateLabel, geographyLabel, seasonLabel, weatherText } from "@/lib/weather/labels";

/** Bounds for typed temperatures, in °C: colder than Antarctica's record or hotter than Death Valley's is a typo. */
const TEMP_RANGE = { min: -90, max: 60 };

type Choice = Exclude<keyof WeatherOptions, "minTemp" | "maxTemp">;

/** Advanced Tools › Weather Generator: a whole day of believable weather for a climate, place and season. */
export default function WeatherGenerator({ worldId }: { worldId: string }) {
  const t = useT("weather");
  const { settings } = useSettings();
  const unit = settings.temperatureUnit;
  const symbol = temperatureSymbol(unit);
  const [opts, setOpts] = useState<Omit<WeatherOptions, "minTemp" | "maxTemp">>(DEFAULT_WEATHER_OPTIONS);
  const [minText, setMinText] = useState("");
  const [maxText, setMaxText] = useState("");
  const { entries, add, attach } = useWeatherHistory(worldId);
  const calendar = useDefaultCalendar();
  const [openId, setOpenId] = useState<string | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [attachedTo, setAttachedTo] = useState<string | null>(null);
  const dateOf = (worldDay: number) => (calendar ? dayLabel(calendar.def, worldDay, { weekday: false }) : t("gen.dayN", { n: worldDay }));
  const open = entries.find((e) => e.id === openId) ?? null;
  const temp = (c: number) => `${Math.round(fromCelsius(c, unit))}${symbol}`;
  const [error, setError] = useState<string | null>(null);

  const geographyOptions = [{ value: "random", label: t("ui.random") }, ...GEOGRAPHY_NAMES.map((g) => ({ value: g, label: geographyLabel(g, t) }))];

  const set = (key: Choice, value: string) => setOpts((o) => ({ ...o, [key]: value }));

  /** A typed temperature in °C; null when empty, undefined when invalid. */
  function readTemp(text: string): number | null | undefined {
    if (!text.trim()) return null;
    const value = Number(text.replace(",", "."));
    if (!Number.isFinite(value)) return undefined;
    const c = toCelsius(value, unit);
    return c >= TEMP_RANGE.min && c <= TEMP_RANGE.max ? c : undefined;
  }

  function generate() {
    const minTemp = readTemp(minText);
    const maxTemp = readTemp(maxText);
    if (minTemp === undefined || maxTemp === undefined) {
      const bound = (c: number) => `${Math.round(fromCelsius(c, unit))}${symbol}`;
      setError(t("gen.tempRange", { min: bound(TEMP_RANGE.min), max: bound(TEMP_RANGE.max) }));
      return;
    }
    if (minTemp !== null && maxTemp !== null && minTemp > maxTemp) {
      setError(t("gen.minAboveMax"));
      return;
    }
    setError(null);
    const entry: WeatherEntry = { id: crypto.randomUUID(), createdAt: Date.now(), day: generateWeatherDay({ ...opts, minTemp, maxTemp }) };
    add(entry);
    setOpenId(entry.id);
    setAttachedTo(null);
  }

  return (
    <>
      <header className="settings-header">
        <div>
          <h1 className="tool-title">
            <CloudSun size={22} strokeWidth={2.25} aria-hidden />
            {t("gen.title")}
          </h1>
          <p>{t("gen.intro")}</p>
        </div>
      </header>

      <section className="settings-card">
        <div className="settings-card-head">
          <h2>{t("gen.options")}</h2>
          <p>{t("gen.optionsHint", { symbol })}</p>
        </div>
        <div className="settings-card-body">
          <SettingRow label={t("gen.climate")} description={t("gen.climateHint")} htmlFor="weather-climate">
            <select id="weather-climate" value={opts.climate} onChange={(e) => set("climate", e.target.value)}>
              <option value="random">{t("ui.random")}</option>
              {CLIMATES.map((c) => (
                <option key={c} value={c}>
                  {climateLabel(c, t)}
                </option>
              ))}
            </select>
          </SettingRow>
          <SettingRow label={t("gen.geography")} description={t("gen.geographyHint")}>
            <InfoPicker ariaLabel={t("gen.geography")} placeholder={t("ui.random")} options={geographyOptions} value={opts.geography} onChange={(v) => set("geography", v ?? "random")} />
          </SettingRow>
          <SettingRow label={t("gen.season")} htmlFor="weather-season">
            <select id="weather-season" value={opts.season} onChange={(e) => set("season", e.target.value)}>
              <option value="random">{t("ui.random")}</option>
              {SEASONS.map((s) => (
                <option key={s} value={s}>
                  {seasonLabel(s, t)}
                </option>
              ))}
            </select>
          </SettingRow>
          <SettingRow label={t("gen.minTemp", { symbol })} description={t("gen.minHint")} htmlFor="weather-min">
            <input id="weather-min" type="text" inputMode="decimal" className="weather-temp-input" value={minText} placeholder={t("gen.auto")} onChange={(e) => setMinText(e.target.value)} />
          </SettingRow>
          <SettingRow label={t("gen.maxTemp", { symbol })} description={t("gen.maxHint")} htmlFor="weather-max">
            <input id="weather-max" type="text" inputMode="decimal" className="weather-temp-input" value={maxText} placeholder={t("gen.auto")} onChange={(e) => setMaxText(e.target.value)} />
          </SettingRow>
        </div>
      </section>

      <div className="tool-actions">
        <button type="button" className="btn btn-primary" onClick={generate}>
          <Dices size={16} strokeWidth={2.25} aria-hidden />
          {t("gen.generate")}
        </button>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <RecentList
        title={t("gen.recent")}
        noun={t("gen.noun")}
        onOpen={setOpenId}
        items={entries.map((e) => {
          const wet = e.day.segments.find((s) => e.day.hours[s.start].precipitation && !e.day.underground);
          return {
            id: e.id,
            createdAt: e.createdAt,
            title: `${temp(e.day.low)} / ${temp(e.day.high)}`,
            meta: [climateLabel(e.day.climate, t), geographyLabel(e.day.geography, t), seasonLabel(e.day.season, t), ...(wet ? [t("gen.wetFrom", { label: weatherText(wet.label, t).toLocaleLowerCase(), hour: hourLabel(wet.start) })] : [])].join(" · "),
            extra: e.calendarDays.length > 0 && (
              <span className="tool-history-badge" data-tooltip={t("gen.onCalendarList", { dates: e.calendarDays.map(dateOf).join(", ") })}>
                <CalendarCheck size={13} strokeWidth={2.5} aria-hidden />
                {t("gen.calendarBadge")}
              </span>
            ),
          };
        })}
      />

      {open && (
        <WeatherModal
          key={open.id}
          day={open.day}
          onClose={() => {
            setOpenId(null);
            setAttachedTo(null);
          }}
          extra={
            open.calendarDays.length > 0 && (
              <p className="weather-attached">
                <CalendarCheck size={15} strokeWidth={2.25} aria-hidden />
                {t("gen.onCalendar")}{" "}
                {open.calendarDays.map((d, i) => (
                  <span key={`${d}-${i}`}>
                    {i > 0 && ", "}
                    <Link href={`/calendars?day=${d}`}>{dateOf(d)}</Link>
                  </span>
                ))}
              </p>
            )
          }
          actions={
            <>
              <button type="button" className="btn btn-sm btn-ghost" onClick={generate}>
                <Dices size={15} strokeWidth={2.25} aria-hidden />
                {t("gen.another")}
              </button>
              {attachedTo && (
                <span className="cod-created" role="status">
                  <CalendarCheck size={15} strokeWidth={2.5} aria-hidden />
                  {t("gen.attachedTo", { date: attachedTo })}
                </span>
              )}
              <button type="button" className="btn btn-sm btn-primary" onClick={() => setAttaching(true)}>
                <CalendarPlus size={15} strokeWidth={2.25} aria-hidden />
                {t("gen.attach")}
              </button>
            </>
          }
        />
      )}
      {open && attaching && (
        <AttachWeatherModal
          day={open.day}
          onClose={() => setAttaching(false)}
          onAttached={(attachmentId, label) => {
            attach(open.id, attachmentId);
            setAttaching(false);
            setAttachedTo(label);
          }}
        />
      )}
    </>
  );
}
