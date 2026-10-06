"use client";

import { createElement, useState } from "react";
import { CloudDrizzle, CloudFog, CloudHail, CloudLightning, CloudMoon, CloudRain, CloudSnow, CloudSun, Cloudy, Moon, Mountain, Sun, Wind, type LucideIcon } from "lucide-react";
import Modal from "@/components/Modal";
import { useSettings } from "@/components/settings/SettingsProvider";
import { fromCelsius, fromKmh, speedUnit, temperatureSymbol } from "@/server/settings/units";
import { DARK_TIMES } from "@/lib/weather/options";
import { hourLabel, type WeatherDay, type WeatherHour } from "@/lib/weather/generate";
import WeatherTimeline from "./WeatherTimeline";

/** The hour shown first: midday, when most scenes happen. */
const FIRST_HOUR = 12;

/** The icon that sums an hour up. */
export function hourIcon(h: WeatherHour): LucideIcon {
  const dark = DARK_TIMES.has(h.timeOfDay);
  if (h.condition === "underground") return Mountain;
  const p = h.precipitation;
  if (p?.thunder) return CloudLightning;
  if (p?.type === "hail") return CloudHail;
  if (p?.type === "snow" || p?.type === "sleet") return CloudSnow;
  if (p?.type === "drizzle") return CloudDrizzle;
  if (p) return CloudRain;
  if (h.fog) return CloudFog;
  if (h.beaufort >= 6) return Wind;
  if (h.cover === "clear") return dark ? Moon : Sun;
  if (h.cover === "partly") return dark ? CloudMoon : CloudSun;
  return Cloudy;
}

/** "Mostly cloudy; light rain 14:00–18:00": the longest dry stretch, then each wet one. */
export function daySummary(day: WeatherDay): string {
  const dry = day.segments.filter((s) => !day.hours[s.start].precipitation);
  const longest = [...dry].sort((a, b) => b.end - b.start - (a.end - a.start))[0];
  const wet = day.segments.filter((s) => day.hours[s.start].precipitation && !day.underground);
  const parts = [longest ? longest.label : "Wet all day", ...wet.slice(0, 2).map((s) => `${s.label.toLowerCase()} ${hourLabel(s.start)}–${hourLabel(s.end)}`)];
  if (wet.length > 2) parts.push("more showers later");
  return parts.join("; ");
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="tool-fact">
      <span className="tool-fact-label">{label}</span>
      <span className="tool-fact-value">{value}</span>
    </div>
  );
}

interface WeatherModalProps {
  day: WeatherDay;
  onClose: () => void;
  /** Shown under the report, e.g. where it applies. */
  extra?: React.ReactNode;
  /** The buttons at the bottom. */
  actions: React.ReactNode;
}

/**
 * A generated day of weather: timeline, the selected hour in detail, and
 * what the day means for travellers. Render it keyed by the day's id, so
 * another day starts again at midday.
 */
export default function WeatherModal({ day, onClose, extra, actions }: WeatherModalProps) {
  const { settings } = useSettings();
  const [selected, setSelected] = useState(FIRST_HOUR);
  const temp = (c: number) => `${Math.round(fromCelsius(c, settings.temperatureUnit))}${temperatureSymbol(settings.temperatureUnit)}`;
  const speed = (kmh: number) => `${Math.round(fromKmh(kmh, settings.lengthSystem))} ${speedUnit(settings.lengthSystem)}`;
  const h = day.hours[selected];
  const windows = (w: [number, number][]) => (w.length === 1 && w[0][0] === 0 && w[0][1] === 24 ? "All day" : w.map(([a, b]) => `${hourLabel(a)}–${hourLabel(b)}`).join(", "));

  return (
    <Modal open onClose={onClose} title="Weather" size="wide">
      <div className="tool-hero">
        <div className="tool-avatar weather-icon" aria-hidden>
          {createElement(hourIcon(day.hours[FIRST_HOUR]), { size: 30, strokeWidth: 2 })}
        </div>
        <div className="tool-hero-text">
          <h3 className="tool-hero-name">
            {temp(day.low)} / {temp(day.high)} <span className="weather-summary">{daySummary(day)}</span>
          </h3>
          <div className="tool-tags">
            <span className="tool-tag">{day.climate}</span>
            <span className="tool-tag">{day.geography}</span>
            <span className="tool-tag tool-tag-accent">{day.season}</span>
          </div>
        </div>
      </div>

      <WeatherTimeline day={day} selected={selected} onSelect={setSelected} formatTemp={temp} />

      <div className="tool-sheet">
        <div className="weather-hour-head">
          {createElement(hourIcon(h), { size: 18, strokeWidth: 2.25, "aria-hidden": true })}
          <strong>
            {hourLabel(h.hour)} · {h.timeOfDay}
          </strong>
          <span>{temp(h.temp)}</span>
        </div>
        <div className="tool-facts">
          <Fact label="Sky" value={h.sky} />
          <Fact label="Precipitation" value={h.precipitationLabel} />
        </div>
        <div className="tool-facts">
          <Fact label="Wind force" value={h.windForce} />
          <Fact label="Wind speed" value={speed(h.windKmh)} />
          <Fact label="Gusts" value={h.gustKmh === null ? "None" : `Up to ${speed(h.gustKmh)}`} />
          <Fact label="Wind direction" value={h.direction} />
        </div>
        <div className="weather-effects">
          <span className="tool-fact-label">At this hour</span>
          <ul>
            {h.effects.map((effect) => (
              <li key={effect}>{effect}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="tool-sheet">
        <div className="weather-effects">
          <span className="tool-fact-label">Practical effects today</span>
          <ul>
            {day.effects.map((effect) => (
              <li key={effect.text}>
                {effect.text}
                <span className="weather-when">{windows(effect.windows)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {extra}

      <div className="tool-modal-actions">{actions}</div>
    </Modal>
  );
}
