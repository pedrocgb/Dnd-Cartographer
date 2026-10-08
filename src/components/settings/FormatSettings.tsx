"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import SegmentedControl from "@/components/marker-panel/SegmentedControl";
import { useSettings } from "./SettingsProvider";
import { SettingError, SettingRow, SettingsCard, SettingsHeader } from "./parts";
import { NUMBER_FORMATS, REAL_DATE_FORMATS, WORLD_DATE_FORMATS, type AppSettings, type RealDateFormat, type TemperatureUnit, type UnitSystem, type WorldDateFormat } from "@/server/settings/settings";
import { formatDecimal } from "@/server/settings/number-format";
import { applyDateFormat, formatRealDate } from "@/server/settings/date-format";
import { useT } from "@/i18n/useT";

const NUMBER_SAMPLE = 1_000_000.23;

/** A sample in-world date for the preview: no calendar needed (a made-up month and era, not translated). */
const sampleWorldDate = (format: WorldDateFormat) => applyDateFormat(format, { day: 12, month: 3, monthName: "Alder", year: "1024 AR" });

export default function FormatSettings() {
  const { settings, updateSetting } = useSettings();
  const t = useT("settings");
  const [error, setError] = useState<string | null>(null);
  const save = async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => setError(await updateSetting(key, value));
  const today = new Date();
  const systemSegments = [
    { key: "metric", label: t("formats.metric") },
    { key: "imperial", label: t("formats.imperial") },
  ] as const;
  const temperatureSegments = [
    { key: "celsius", label: t("formats.temperature.celsius") },
    { key: "fahrenheit", label: t("formats.temperature.fahrenheit") },
  ] as const;

  return (
    <>
      <SettingsHeader title={t("formats.title")} description={t("formats.description")} />
      <SettingError message={error} />

      <SettingsCard title={t("formats.units.title")} description={t("formats.units.description")}>
        <SettingRow label={t("formats.weight")} description={t(settings.weightSystem === "metric" ? "formats.weight.metric" : "formats.weight.imperial")}>
          <SegmentedControl<UnitSystem> ariaLabel={t("formats.weight")} value={settings.weightSystem} segments={systemSegments} onChange={(v) => save("weightSystem", v)} />
        </SettingRow>
        <SettingRow label={t("formats.length")} description={t(settings.lengthSystem === "metric" ? "formats.length.metric" : "formats.length.imperial")}>
          <SegmentedControl<UnitSystem> ariaLabel={t("formats.length.label")} value={settings.lengthSystem} segments={systemSegments} onChange={(v) => save("lengthSystem", v)} />
        </SettingRow>
        <SettingRow label={t("formats.temperature")} description={t(settings.temperatureUnit === "celsius" ? "formats.temperature.celsiusDescription" : "formats.temperature.fahrenheitDescription")}>
          <SegmentedControl<TemperatureUnit> ariaLabel={t("formats.temperature")} value={settings.temperatureUnit} segments={temperatureSegments} onChange={(v) => save("temperatureUnit", v)} />
        </SettingRow>
      </SettingsCard>

      <SettingsCard title={t("formats.numbers.title")} description={t("formats.numbers.description")}>
        <div className="settings-choice-grid" role="radiogroup" aria-label={t("formats.numbers.label")}>
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
                  <strong>{t(`formats.numbers.${key}`)}</strong>
                  <span className="settings-number-sample">{formatDecimal(NUMBER_SAMPLE, { format: key })}</span>
                  <span>{t(`formats.numbers.${key}Separators`)}</span>
                </span>
                {selected && <Check size={16} strokeWidth={2.5} className="settings-choice-check" aria-hidden />}
              </button>
            );
          })}
        </div>
      </SettingsCard>

      <SettingsCard title={t("formats.dates.title")} description={t("formats.dates.description")}>
        <SettingRow label={t("formats.dates.real")} description={t("formats.dates.realToday", { date: formatRealDate(today, settings.realDateFormat, { language: settings.language }) })} htmlFor="settings-real-date">
          <select id="settings-real-date" value={settings.realDateFormat} onChange={(e) => save("realDateFormat", e.target.value as RealDateFormat)}>
            {REAL_DATE_FORMATS.map((format) => (
              <option key={format} value={format}>
                {format} · {formatRealDate(today, format, { language: settings.language })}
              </option>
            ))}
          </select>
        </SettingRow>
        <SettingRow label={t("formats.dates.world")} description={t("formats.dates.worldExample", { date: sampleWorldDate(settings.worldDateFormat) })} htmlFor="settings-world-date">
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
