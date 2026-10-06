"use client";

import { useRef } from "react";
import { hourLabel, type Condition, type WeatherDay } from "@/lib/weather/generate";

/** Each condition's name in the legend; the colours live in globals.css (.wx-<condition>). */
export const CONDITION_NAMES: Record<Condition, string> = {
  clear: "Clear",
  partly: "Partly cloudy",
  cloudy: "Cloudy",
  fog: "Fog or mist",
  drizzle: "Drizzle",
  rain: "Rain",
  sleet: "Sleet",
  storm: "Thunderstorm",
  snow: "Snow",
  dust: "Dust or sand",
  underground: "Underground",
};

const CHART_H = 76;
const PAD_Y = 20;
/** A segment needs this many hours before its name fits above it; shorter ones show it on hover. */
const LABEL_MIN_HOURS = 3;

/**
 * The day at a glance: a temperature line over a bar of the weather hour by
 * hour (one coloured stretch per spell, named above it), hour marks below.
 * Each hour is a button: hover names it, a click or ←/→ selects it.
 */
export default function WeatherTimeline({
  day,
  selected,
  onSelect,
  formatTemp,
}: {
  day: WeatherDay;
  selected: number;
  onSelect: (hour: number) => void;
  formatTemp: (celsius: number) => string;
}) {
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const temps = day.hours.map((h) => h.temp);
  const min = Math.min(...temps);
  const max = Math.max(...temps);
  const span = Math.max(1, max - min);
  const y = (t: number) => PAD_Y + (1 - (t - min) / span) * (CHART_H - 2 * PAD_Y);
  const x = (hour: number) => hour + 0.5;
  const points = day.hours.map((h) => `${x(h.hour)},${y(h.temp)}`).join(" ");
  const warmest = day.hours.reduce((a, b) => (b.temp > a.temp ? b : a));
  const coldest = day.hours.reduce((a, b) => (b.temp < a.temp ? b : a));
  const conditions = [...new Set(day.segments.map((s) => s.condition))];

  function onKeyDown(e: React.KeyboardEvent) {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    const next = e.key === "Home" ? 0 : e.key === "End" ? 23 : selected + step;
    if ((step || e.key === "Home" || e.key === "End") && next >= 0 && next <= 23) {
      e.preventDefault();
      onSelect(next);
      buttonsRef.current[next]?.focus();
    }
  }

  return (
    <div className="wx-timeline">
      <div className="wx-scroll">
        <div className="wx-grid">
          <div className="wx-labels" aria-hidden>
            {day.segments.map((s) => (
              <span key={s.start} style={{ gridColumn: `${s.start + 1} / ${s.end + 1}` }}>
                {s.end - s.start >= LABEL_MIN_HOURS ? s.label : ""}
              </span>
            ))}
          </div>

          <div className="wx-chart" style={{ height: CHART_H }}>
          <svg className="wx-temps" viewBox={`0 0 24 ${CHART_H}`} preserveAspectRatio="none" aria-hidden>
            <rect className="wx-selected-col" x={selected} y={0} width={1} height={CHART_H} />
            <polyline points={points} vectorEffect="non-scaling-stroke" />
          </svg>
          <div className="wx-temp-marks" aria-hidden>
            <span style={{ left: `${(x(warmest.hour) / 24) * 100}%`, top: y(warmest.temp) - 18 }}>{formatTemp(warmest.temp)}</span>
            <span style={{ left: `${(x(coldest.hour) / 24) * 100}%`, top: y(coldest.temp) + 4 }}>{formatTemp(coldest.temp)}</span>
            <i style={{ left: `${(x(warmest.hour) / 24) * 100}%`, top: y(warmest.temp) }} />
            <i style={{ left: `${(x(coldest.hour) / 24) * 100}%`, top: y(coldest.temp) }} />
          </div>
          </div>

          <div className="wx-bar" aria-hidden>
            {day.segments.map((s) => (
              <span key={s.start} className={`wx-segment wx-${s.condition}`} style={{ gridColumn: `${s.start + 1} / ${s.end + 1}` }} />
            ))}
          </div>

          <div className="wx-hours" role="group" aria-label="Hours of the day" onKeyDown={onKeyDown}>
            {day.hours.map((h) => (
              <button
                key={h.hour}
                ref={(el) => {
                  buttonsRef.current[h.hour] = el;
                }}
                type="button"
                className={h.hour === selected ? "wx-hour selected" : "wx-hour"}
                aria-pressed={h.hour === selected}
                aria-label={`${hourLabel(h.hour)}: ${formatTemp(h.temp)}, ${h.label}`}
                data-tooltip={`${hourLabel(h.hour)} · ${formatTemp(h.temp)} · ${h.label}`}
                tabIndex={h.hour === selected ? 0 : -1}
                onClick={() => onSelect(h.hour)}
              />
            ))}
          </div>

          <div className="wx-ticks" aria-hidden>
            {[0, 3, 6, 9, 12, 15, 18, 21].map((hour) => (
              <span key={hour} style={{ gridColumn: `${hour + 1} / span 3` }}>
                {hourLabel(hour)}
              </span>
            ))}
          </div>
        </div>
      </div>

      <ul className="wx-legend" aria-label="Legend">
        {conditions.map((c) => (
          <li key={c}>
            <span className={`wx-swatch wx-${c}`} aria-hidden />
            {CONDITION_NAMES[c]}
          </li>
        ))}
      </ul>
    </div>
  );
}
