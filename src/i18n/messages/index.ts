import type { Locale } from "../config";
import enArticles from "./en-US/articles.json";
import enCalendars from "./en-US/calendars.json";
import enCampaign from "./en-US/campaign.json";
import enCharacter from "./en-US/character.json";
import enCommon from "./en-US/common.json";
import enEditor from "./en-US/editor.json";
import enErrors from "./en-US/errors.json";
import enIcons from "./en-US/icons.json";
import enInfo from "./en-US/info.json";
import enMaps from "./en-US/maps.json";
import enNav from "./en-US/nav.json";
import enPolitics from "./en-US/politics.json";
import enRelations from "./en-US/relations.json";
import enSettings from "./en-US/settings.json";
import enSettlement from "./en-US/settlement.json";
import enShortcuts from "./en-US/shortcuts.json";
import enTools from "./en-US/tools.json";
import enWeather from "./en-US/weather.json";
import enTrash from "./en-US/trash.json";
import enWorlds from "./en-US/worlds.json";
import enWriter from "./en-US/writer.json";
import ptArticles from "./pt-BR/articles.json";
import ptCalendars from "./pt-BR/calendars.json";
import ptCampaign from "./pt-BR/campaign.json";
import ptCharacter from "./pt-BR/character.json";
import ptCommon from "./pt-BR/common.json";
import ptEditor from "./pt-BR/editor.json";
import ptErrors from "./pt-BR/errors.json";
import ptIcons from "./pt-BR/icons.json";
import ptInfo from "./pt-BR/info.json";
import ptMaps from "./pt-BR/maps.json";
import ptNav from "./pt-BR/nav.json";
import ptPolitics from "./pt-BR/politics.json";
import ptRelations from "./pt-BR/relations.json";
import ptSettings from "./pt-BR/settings.json";
import ptSettlement from "./pt-BR/settlement.json";
import ptShortcuts from "./pt-BR/shortcuts.json";
import ptTools from "./pt-BR/tools.json";
import ptWeather from "./pt-BR/weather.json";
import ptTrash from "./pt-BR/trash.json";
import ptWorlds from "./pt-BR/worlds.json";
import ptWriter from "./pt-BR/writer.json";

/**
 * Every namespace of every locale, imported statically so switching language
 * re-renders at once (no fetch). en-US is the source: its keys type `t()`.
 * New namespace: add its JSON in both folders and one line per locale here.
 */
const EN = { articles: enArticles, calendars: enCalendars, campaign: enCampaign, character: enCharacter, common: enCommon, editor: enEditor, errors: enErrors, icons: enIcons, info: enInfo, maps: enMaps, nav: enNav, politics: enPolitics, relations: enRelations, settings: enSettings, settlement: enSettlement, shortcuts: enShortcuts, tools: enTools, trash: enTrash, weather: enWeather, worlds: enWorlds, writer: enWriter };

export type Namespace = keyof typeof EN;
export type Dictionary = Record<string, string>;

export const MESSAGES: Record<Locale, { [N in Namespace]: Dictionary }> = {
  "en-US": EN,
  "pt-BR": { articles: ptArticles, calendars: ptCalendars, campaign: ptCampaign, character: ptCharacter, common: ptCommon, editor: ptEditor, errors: ptErrors, icons: ptIcons, info: ptInfo, maps: ptMaps, nav: ptNav, politics: ptPolitics, relations: ptRelations, settings: ptSettings, settlement: ptSettlement, shortcuts: ptShortcuts, tools: ptTools, trash: ptTrash, weather: ptWeather, worlds: ptWorlds, writer: ptWriter },
};

type PluralSuffix = "zero" | "one" | "other";
type RawKey<N extends Namespace> = keyof (typeof EN)[N] & string;
/** A namespace's keys; plural entries (`items_one`, `items_other`) are also callable by their base (`items`). */
export type MessageKey<N extends Namespace> = RawKey<N> | (RawKey<N> extends infer K ? (K extends `${infer Base}_${PluralSuffix}` ? Base : never) : never);
