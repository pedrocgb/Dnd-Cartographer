import type { Locale } from "../config";
import enCommon from "./en-US/common.json";
import enErrors from "./en-US/errors.json";
import enNav from "./en-US/nav.json";
import enSettings from "./en-US/settings.json";
import enShortcuts from "./en-US/shortcuts.json";
import enTools from "./en-US/tools.json";
import enTrash from "./en-US/trash.json";
import enWorlds from "./en-US/worlds.json";
import ptCommon from "./pt-BR/common.json";
import ptErrors from "./pt-BR/errors.json";
import ptNav from "./pt-BR/nav.json";
import ptSettings from "./pt-BR/settings.json";
import ptShortcuts from "./pt-BR/shortcuts.json";
import ptTools from "./pt-BR/tools.json";
import ptTrash from "./pt-BR/trash.json";
import ptWorlds from "./pt-BR/worlds.json";

/**
 * Every namespace of every locale, imported statically so switching language
 * re-renders at once (no fetch). en-US is the source: its keys type `t()`.
 * New namespace: add its JSON in both folders and one line per locale here.
 */
const EN = { common: enCommon, errors: enErrors, nav: enNav, settings: enSettings, shortcuts: enShortcuts, tools: enTools, trash: enTrash, worlds: enWorlds };

export type Namespace = keyof typeof EN;
export type Dictionary = Record<string, string>;

export const MESSAGES: Record<Locale, { [N in Namespace]: Dictionary }> = {
  "en-US": EN,
  "pt-BR": { common: ptCommon, errors: ptErrors, nav: ptNav, settings: ptSettings, shortcuts: ptShortcuts, tools: ptTools, trash: ptTrash, worlds: ptWorlds },
};

type PluralSuffix = "zero" | "one" | "other";
type RawKey<N extends Namespace> = keyof (typeof EN)[N] & string;
/** A namespace's keys; plural entries (`items_one`, `items_other`) are also callable by their base (`items`). */
export type MessageKey<N extends Namespace> = RawKey<N> | (RawKey<N> extends infer K ? (K extends `${infer Base}_${PluralSuffix}` ? Base : never) : never);
