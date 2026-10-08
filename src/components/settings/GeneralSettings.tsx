"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import Toggle from "@/components/Toggle";
import { useSettings } from "./SettingsProvider";
import { SettingError, SettingRow, SettingsCard, SettingsHeader } from "./parts";
import type { Language } from "@/server/settings/settings";
import { useT } from "@/i18n/useT";

/** Drawn, not emoji: Windows has no flag emoji. */
function FlagBrazil() {
  return (
    <svg viewBox="0 0 28 20" className="settings-flag" aria-hidden>
      <rect width="28" height="20" fill="#009c3b" />
      <path d="M14 2.5 25.5 10 14 17.5 2.5 10Z" fill="#ffdf00" />
      <circle cx="14" cy="10" r="4.6" fill="#002776" />
      <path d="M9.6 9.1c2.9-.6 6.1-.2 8.7 1.3" stroke="#fff" strokeWidth="0.8" fill="none" />
    </svg>
  );
}

function FlagUSA() {
  const stripes = Array.from({ length: 7 }, (_, i) => <rect key={i} y={(i * 2 * 20) / 13} width="28" height={20 / 13} fill="#b22234" />);
  return (
    <svg viewBox="0 0 28 20" className="settings-flag" aria-hidden>
      <rect width="28" height="20" fill="#fff" />
      {stripes}
      <rect width="11.2" height={(7 * 20) / 13} fill="#3c3b6e" />
    </svg>
  );
}

/** Each language is named in itself, so it reads right whatever the current language is. */
const LANGUAGE_OPTIONS:{ key: Language; label: string; region: string; flag: React.ReactNode }[] = [
  { key: "en-US", label: "English", region: "United States", flag: <FlagUSA /> },
  { key: "pt-BR", label: "Português", region: "Brasil", flag: <FlagBrazil /> },
];

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
                {option.flag}
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
