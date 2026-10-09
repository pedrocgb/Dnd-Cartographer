"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import Toggle from "@/components/Toggle";
import { useSettings } from "./SettingsProvider";
import { SettingError, SettingRow, SettingsCard, SettingsHeader } from "./parts";
import { LANGUAGE_OPTIONS } from "./languages";
import { useT } from "@/i18n/useT";

export default function GeneralSettings() {
  const { settings, updateSetting } = useSettings();
  const t = useT("settings");
  const [error, setError] = useState<string | null>(null);
  const [barError, setBarError] = useState<string | null>(null);

  return (
    <>
      <SettingsHeader title={t("general.title")} description={t("general.description")} />
      <SettingsCard title={t("general.language.title")} description={t("general.language.description")}>
        <div className="settings-choice-grid" role="radiogroup" aria-label={t("general.language.title")}>
          {LANGUAGE_OPTIONS.map((option) => {
            const selected = settings.language === option.key;
            return (
              <button
                key={option.key}
                type="button"
                role="radio"
                aria-checked={selected}
                className={selected ? "settings-choice active" : "settings-choice"}
                onClick={async () => setError(await updateSetting("language", option.key))}
              >
                <option.Flag className="settings-flag" />
                <span className="settings-choice-text">
                  <strong>{option.label}</strong>
                  <span>{option.region}</span>
                </span>
                {selected && <Check size={16} strokeWidth={2.5} className="settings-choice-check" aria-hidden />}
              </button>
            );
          })}
        </div>
        <SettingError message={error} />
      </SettingsCard>
      <SettingsCard title={t("general.topBar.title")} description={t("general.topBar.description")}>
        <SettingRow label={t("general.worldDate.label")} description={t("general.worldDate.description")}>
          <Toggle checked={settings.showWorldDate} label={settings.showWorldDate ? t("general.worldDate.shown") : t("general.worldDate.hidden")} onChange={async (on) => setBarError(await updateSetting("showWorldDate", on))} />
        </SettingRow>
        <SettingError message={barError} />
      </SettingsCard>
    </>
  );
}
