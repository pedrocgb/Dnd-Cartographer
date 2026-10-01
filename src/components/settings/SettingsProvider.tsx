"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_SETTINGS, type AppSettings } from "@/server/settings/settings";
import { setActiveSettings } from "@/server/settings/active";

interface SettingsState {
  settings: AppSettings;
  /** Applies right away; rolls back (and returns the error) if the server rejects it. */
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<string | null>;
}

const SettingsContext = createContext<SettingsState>({
  settings: DEFAULT_SETTINGS,
  updateSetting: async () => null,
});

/** The app-wide preferences (PATCH /api/settings), loaded with the page by the root layout. */
export default function SettingsProvider({ initialSettings, children }: { initialSettings: AppSettings; children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(initialSettings);
  // Before the children render, so formatters reading the active settings see these.
  setActiveSettings(settings);
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  });

  const updateSetting = useCallback(async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const previous = settingsRef.current[key];
    setSettings((s) => ({ ...s, [key]: value }));
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      const data: { settings?: AppSettings; error?: string } = await res.json().catch(() => ({}));
      if (!res.ok || !data.settings) throw new Error(data.error ?? "Couldn't save the setting.");
      setSettings(data.settings);
      return null;
    } catch (err) {
      setSettings((s) => ({ ...s, [key]: previous }));
      return err instanceof Error ? err.message : "Couldn't save the setting.";
    }
  }, []);

  const value = useMemo(() => ({ settings, updateSetting }), [settings, updateSetting]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsState {
  return useContext(SettingsContext);
}
