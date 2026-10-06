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

const GEOGRAPHY_OPTIONS = [{ value: "random", label: "Random" }, ...GEOGRAPHY_NAMES.map((g) => ({ value: g, label: g }))];
/** Bounds for typed temperatures, in °C: colder than Antarctica's record or hotter than Death Valley's is a typo. */
const TEMP_RANGE = { min: -90, max: 60 };

type Choice = Exclude<keyof WeatherOptions, "minTemp" | "maxTemp">;

/** Advanced Tools › Weather Generator: a whole day of believable weather for a climate, place and season. */
export default function WeatherGenerator({ worldId }: { worldId: string }) {
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
  const dateOf = (worldDay: number) => (calendar ? dayLabel(calendar.def, worldDay, { weekday: false }) : `Day ${worldDay}`);
  const open = entries.find((e) => e.id === openId) ?? null;
  const temp = (c: number) => `${Math.round(fromCelsius(c, unit))}${symbol}`;
  const [error, setError] = useState<string | null>(null);

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
      setError(`Temperatures must be numbers between ${bound(TEMP_RANGE.min)} and ${bound(TEMP_RANGE.max)}.`);
      return;
    }
    if (minTemp !== null && maxTemp !== null && minTemp > maxTemp) {
      setError("The minimum temperature is higher than the maximum.");
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
            Weather Generator
          </h1>
          <p>Roll a whole day of weather: pick a climate, a place and a season, and get the sky, rain, wind and temperatures hour by hour, following real-world rules, with what they mean for travellers.</p>
        </div>
      </header>

      <section className="settings-card">
        <div className="settings-card-head">
          <h2>Generation options</h2>
          <p>Real-world seasons, unrelated to your calendars. Temperatures are in {symbol}, as set in Settings › Units &amp; formats.</p>
        </div>
        <div className="settings-card-body">
          <SettingRow label="Climate" description="The broad climate zone, from steamy tropics to polar ice." htmlFor="weather-climate">
            <select id="weather-climate" value={opts.climate} onChange={(e) => set("climate", e.target.value)}>
              <option value="random">Random</option>
              {CLIMATES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </SettingRow>
          <SettingRow label="Geography" description="Height, water and shelter change the temperature, rain and wind.">
            <InfoPicker ariaLabel="Geography" placeholder="Random" options={GEOGRAPHY_OPTIONS} value={opts.geography} onChange={(v) => set("geography", v ?? "random")} />
          </SettingRow>
          <SettingRow label="Season" htmlFor="weather-season">
            <select id="weather-season" value={opts.season} onChange={(e) => set("season", e.target.value)}>
              <option value="random">Random</option>
              {SEASONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </SettingRow>
          <SettingRow label={`Min temperature (${symbol})`} description="Optional. The day's low; leave empty to follow the climate." htmlFor="weather-min">
            <input id="weather-min" type="text" inputMode="decimal" className="weather-temp-input" value={minText} placeholder="Auto" onChange={(e) => setMinText(e.target.value)} />
          </SettingRow>
          <SettingRow label={`Max temperature (${symbol})`} description="Optional. The day's high; leave empty to follow the climate." htmlFor="weather-max">
            <input id="weather-max" type="text" inputMode="decimal" className="weather-temp-input" value={maxText} placeholder="Auto" onChange={(e) => setMaxText(e.target.value)} />
          </SettingRow>
        </div>
      </section>

      <div className="tool-actions">
        <button type="button" className="btn btn-primary" onClick={generate}>
          <Dices size={16} strokeWidth={2.25} aria-hidden />
          Generate
        </button>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <RecentList
        title="Recent weather"
        noun="days of weather"
        onOpen={setOpenId}
        items={entries.map((e) => {
          const wet = e.day.segments.find((s) => e.day.hours[s.start].precipitation && !e.day.underground);
          return {
            id: e.id,
            createdAt: e.createdAt,
            title: `${temp(e.day.low)} / ${temp(e.day.high)}`,
            meta: `${e.day.climate} · ${e.day.geography} · ${e.day.season}${wet ? ` · ${wet.label.toLowerCase()} from ${hourLabel(wet.start)}` : ""}`,
            extra: e.calendarDays.length > 0 && (
              <span className="tool-history-badge" data-tooltip={`On the calendar: ${e.calendarDays.map(dateOf).join(", ")}`}>
                <CalendarCheck size={13} strokeWidth={2.5} aria-hidden />
                Calendar
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
                On the calendar:{" "}
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
                Generate another
              </button>
              {attachedTo && (
                <span className="cod-created" role="status">
                  <CalendarCheck size={15} strokeWidth={2.5} aria-hidden />
                  Attached to {attachedTo}
                </span>
              )}
              <button type="button" className="btn btn-sm btn-primary" onClick={() => setAttaching(true)}>
                <CalendarPlus size={15} strokeWidth={2.25} aria-hidden />
                Attach to calendar
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
