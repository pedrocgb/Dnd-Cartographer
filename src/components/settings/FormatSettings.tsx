"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import SegmentedControl from "@/components/marker-panel/SegmentedControl";
import { useSettings } from "./SettingsProvider";
import { SettingError, SettingRow, SettingsCard, SettingsHeader } from "./parts";
import { NUMBER_FORMATS, REAL_DATE_FORMATS, WORLD_DATE_FORMATS, type AppSettings, type NumberFormat, type RealDateFormat, type TemperatureUnit, type UnitSystem, type WorldDateFormat } from "@/server/settings/settings";
import { formatDecimal } from "@/server/settings/number-format";
import { applyDateFormat, formatRealDate } from "@/server/settings/date-format";

const SYSTEM_SEGMENTS = [
  { key: "metric", label: "Metric" },
  { key: "imperial", label: "Imperial" },
] as const;

const TEMPERATURE_SEGMENTS = [
  { key: "celsius", label: "Celsius (°C)" },
  { key: "fahrenheit", label: "Fahrenheit (°F)" },
] as const;

const NUMBER_FORMAT_OPTIONS: Record<NumberFormat, { label: string; separators: string }> = {
  comma: { label: "Comma", separators: "Thousands with commas, decimal point" },
  point: { label: "Point", separators: "Thousands with points, decimal comma" },
  space: { label: "International", separators: "Thousands with spaces, decimal comma" },
};
const NUMBER_SAMPLE = 1_000_000.23;

/** A sample in-world date for the preview: no calendar needed. */
const sampleWorldDate = (format: WorldDateFormat) => applyDateFormat(format, { day: 12, month: 3, monthName: "Alder", year: "1024 AR" });

export default function FormatSettings() {
  const { settings, updateSetting } = useSettings();
  const [error, setError] = useState<string | null>(null);
  const save = async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => setError(await updateSetting(key, value));
  const today = new Date();

  return (
    <>
      <SettingsHeader title="Units & formats" description="How measurements and dates are shown. Stored values never change, only how they read." />
      <SettingError message={error} />

      <SettingsCard title="Units" description="Used by travel times and supplies, new maps' scale bars, and the examples in measurement fields. What you type in an article stays as written.">
        <SettingRow label="Weight" description={settings.weightSystem === "metric" ? "Kilograms (kg), litres (L)" : "Pounds (lb), gallons (gal)"}>
          <SegmentedControl<UnitSystem> ariaLabel="Weight" value={settings.weightSystem} segments={SYSTEM_SEGMENTS} onChange={(v) => save("weightSystem", v)} />
        </SettingRow>
        <SettingRow label="Length & distance" description={settings.lengthSystem === "metric" ? "Centimetres, metres, kilometres (km/h)" : "Feet, yards, miles (mph)"}>
          <SegmentedControl<UnitSystem> ariaLabel="Length and distance" value={settings.lengthSystem} segments={SYSTEM_SEGMENTS} onChange={(v) => save("lengthSystem", v)} />
        </SettingRow>
        <SettingRow label="Temperature" description={settings.temperatureUnit === "celsius" ? "Degrees Celsius (°C)" : "Degrees Fahrenheit (°F)"}>
          <SegmentedControl<TemperatureUnit> ariaLabel="Temperature" value={settings.temperatureUnit} segments={TEMPERATURE_SEGMENTS} onChange={(v) => save("temperatureUnit", v)} />
        </SettingRow>
      </SettingsCard>

      <SettingsCard title="Numbers" description="How the numbers the app writes are grouped: areas, distances, totals, XP and coins. Numbers you type in your text stay as written.">
        <div className="settings-choice-grid" role="radiogroup" aria-label="Number format">
          {NUMBER_FORMATS.map((key) => {
            const selected = settings.numberFormat === key;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={selected}
                className={selected ? "settings-choice active" : "settings-choice"}
                onClick={() => save("numberFormat", key)}
              >
                <span className="settings-choice-text">
                  <strong>{NUMBER_FORMAT_OPTIONS[key].label}</strong>
                  <span className="settings-number-sample">{formatDecimal(NUMBER_SAMPLE, { format: key })}</span>
                  <span>{NUMBER_FORMAT_OPTIONS[key].separators}</span>
                </span>
                {selected && <Check size={16} strokeWidth={2.5} className="settings-choice-check" aria-hidden />}
              </button>
            );
          })}
        </div>
      </SettingsCard>

      <SettingsCard title="Dates" description="Real-world dates (sessions played, revisions, trash) and in-world dates from your calendars each have their own format.">
        <SettingRow label="Real-world dates" description={`Today: ${formatRealDate(today, settings.realDateFormat)}`} htmlFor="settings-real-date">
          <select id="settings-real-date" value={settings.realDateFormat} onChange={(e) => save("realDateFormat", e.target.value as RealDateFormat)}>
            {REAL_DATE_FORMATS.map((format) => (
              <option key={format} value={format}>
                {format} · {formatRealDate(today, format)}
              </option>
            ))}
          </select>
        </SettingRow>
        <SettingRow label="In-world dates" description={`Example: ${sampleWorldDate(settings.worldDateFormat)}. Numbers count months in calendar order.`} htmlFor="settings-world-date">
          <select id="settings-world-date" value={settings.worldDateFormat} onChange={(e) => save("worldDateFormat", e.target.value as WorldDateFormat)}>
            {WORLD_DATE_FORMATS.map((format) => (
              <option key={format} value={format}>
                {sampleWorldDate(format)}
              </option>
            ))}
          </select>
        </SettingRow>
      </SettingsCard>
    </>
  );
}
