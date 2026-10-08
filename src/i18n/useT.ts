"use client";

import { useMemo } from "react";
import { useSettings } from "@/components/settings/SettingsProvider";
import { createTranslator, type Translator } from "./translate";
import type { Namespace } from "./messages";

/** `t()` for a namespace in the user's language; re-renders when the language setting changes. */
export function useT<N extends Namespace>(ns: N): Translator<N> {
  const { language } = useSettings().settings;
  return useMemo(() => createTranslator(language, ns), [language, ns]);
}
