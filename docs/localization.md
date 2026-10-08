# Localization (en-US + pt-BR)

The app is being localized one batch at a time. This file is the source of truth for how to do it and how far it has got. The local `localize-batch` skill (`.claude/skills/localize-batch`) follows it.

**Scope:** interface text, server messages, default names and generator output. User-written content (articles, people, notes, names typed by the user) is never translated.

**Locale:** the `language` app setting (`app_settings.data`, a JSON blob). It needs no table, no cookie and no URL prefix. en-US is the source text and the fallback.

## Architecture: `src/i18n/`

| File | Use |
|---|---|
| `config.ts` | `LOCALES`, `Locale`, `DEFAULT_LOCALE` (re-exported from `server/settings/settings.ts`) |
| `messages/<locale>/<namespace>.json` | Flat dictionaries, one per feature area. en-US is the source. |
| `messages/index.ts` | Static import map. **A new namespace needs one import per locale here.** |
| `translate.ts` | `translate(locale, ns, key, params?)` and `createTranslator(locale, ns)`. Pure: works on client, server and in tests. |
| `useT.ts` | `const t = useT("maps")` in client components. Re-renders when the language changes. |
| `server.ts` | `const t = await serverT("errors")` in server components, API routes and `src/server/**`. `serverLocale()` returns the locale only. |
| `active.ts` | `activeT(ns)` for client helpers outside components (formatters, label lookups). Reads the language that `SettingsProvider` sets. |

How `t()` behaves:
- `{name}` placeholders take values from `params`.
- A numeric `params.count` picks a plural entry: `key_zero` (only for 0, when present), then `key_one` or `key_other` according to `Intl.PluralRules`. Pass the base key: `t("items", { count })`.
- Lookup falls back to the en-US text, then to the key itself.
- Keys are typed from the en-US JSON, so a wrong key fails `tsc`.

## Conventions

- **Keys:** flat dotted camelCase inside a namespace, grouped by component: `"layerFolders.rename"` in `maps.json`.
- **Namespaces:** `common` (shared words and app-wide), `nav`, `settings`, `maps`, `icons` (marker icons, groups, shapes, label modes, sizes, categories), `politics`, `editor`, `articles`, `calendars`, `campaign`, `writer` (Campaign Writer labels, guides and story structures), `relations` (relation types, groups, derived ties, mention groups), `weather` (Weather Generator codes and UI), `character` (Character On Demand), `tools`, `errors` (server and API messages). Add new ones only when an area clearly needs its own.
- **Whole sentences only:** never build a sentence from pieces. Use `t("deletedOn", { date })`, not `"Deleted " + date`. Word order differs in pt-BR.
- **Visible text includes** JSX text, `placeholder`, `aria-label`, `alt`, `data-tooltip`, `label`/`title`/`description` props, `confirm()`/`alert()`, and error strings that reach the UI.
- **Server errors:** move them to `errors.json`. In routes, `return errorResponse("key", status, extra?, params?)` (`src/i18n/server.ts`; numeric params are written in the user's number format) or use `t(...)` from `serverT("errors")`. `notInWorld(table, id, "mapNotFound")` takes an errors key. Components already show `data.error` as received.
- **Numbers inside messages:** format them first with the existing helpers (`formatDecimal`, `formatInteger`) and pass the result as a param. For plurals, pass the raw number as `count` and the formatted one as `n`: `t("stats.maps", { count, n: formatInteger(count) })` with `"{n} maps"`.
- **Markup inside a sentence** (bold name, link): keep the whole sentence in one message with a placeholder, then split it in the component: `const [before, after] = t("typeToConfirm").split("{text}")`, render `{before}<strong>…</strong>{after}`. `t()` without params leaves `{text}` in place.
- **Catalog arrays** (menus, segments, tool lists): give items a `labelKey`/`id` and translate when rendering; an English `label` may stay as the fallback.
- **Server validators** that return messages (e.g. `parseWorldFields`, `sanitizeSettingsPatch`, `validateRelation`, `validateChain`) return an `errors` key (plus params); the route translates it with `serverT`. Thrown validation errors carry `key`/`params` (see `ImportValidationError`, `RelationError`, `DocumentValidationError`). `errorResponse` formats numeric params except `count`, which picks the plural.
- **Server results with reasons built inside a DB transaction** (e.g. trash purge skips) store a structured reason; a `describe*(reason, t)` helper words it in the route. Don't call `serverT` inside a transaction.
- **Dates:** `formatRealDate` already uses the language for month names. Fantasy calendar month names are user data.
- **Language names** in the picker are written in their own language ("English", "Português") and are not translated.
- **Lint:** add each localized file or folder to `LOCALIZED_GLOBS` in `eslint.config.mjs`. `react/jsx-no-literals` then rejects bare JSX text there. Props aren't checked, so grep for them as well.
- **Tests:** `tests/i18n.test.ts` checks that every locale has exactly the en-US keys, the same placeholders, and an `_other` for every plural. Add a translator test the first time a batch introduces plurals or params.

## Stored English values (no schema change)

| Data | Rule |
|---|---|
| Seeded map categories (`server/maps/seed-categories.ts`) | Seed labels in the active locale; this only happens for a new world. Leave existing rows alone. |
| Default hierarchy profile (`politics/seed.ts`) | The stored name stays `"Default"` because it is looked up by that name. Translate it on display when `name === DEFAULT_PROFILE_NAME`. Create its description in the active locale. |
| Hierarchy types "Empire, Kingdom…" (`hierarchy-config.ts`) | Stored keys that `allowedParentTypes` refers to. Translate built-in types on display (`territoryTypeLabel`); show custom types as typed. |
| Government forms, organization kinds, person statuses, authority roles (`hierarchy-config.ts`) | The English value is stored. Shown through `governmentFormLabel`, `organizationKindLabel`, `personStatusLabel`, `authorityRoleLabel` (`politics` namespace); a value outside the list shows as stored. |
| Article info select options (`server/articles/info-sets/*`) | The English value is the stored key. The display label comes from the dictionary keyed by that value. |
| Weather days (`calendar_weather.data`, plus localStorage history) | New days store codes and render labels at display time. Days saved before that keep their English text and are shown as-is. |
| Generated defaults ("Layer n", "Zone n", "(copy)", "New marker", "New text"), character-on-demand article | Written in the active locale when created. After that they are user content. |
| Share pages | Use the owner's language (the app setting). |
| Marker categories (`MARKER_CATEGORIES`) and tags (status, environment, ownership in `tag-registry.ts`) | The English value is stored. Shown through `markerCategoryLabel` / `markerTagLabel`; a value from an older list shows as stored. |
| Article templates (`TEMPLATE_LABELS`) | The English label stays the reserved tag that `sanitizeTags` drops. On the client, `ARTICLE_TEMPLATES` `label`/`plural`/`description` are getters worded on read (`activeT`), so every caller is localized. Server display uses `templateLabel(key, t)`. |
| Info Bar fields (`server/articles/info-sets/*`) | The data files keep the English labels, hints and option values (the source; options are what is stored). `info-sets/index.ts` gives every field `label`/`hint` getters and every group a `label` getter, read through the `info` namespace (`field.<key>`, `group.<key>`, `hint.<key>` or `hint.<template>.<key>`). `optionLabel(value)` words a select value; a value outside the list shows as stored. |
| Marker icons (`icon-registry.ts`) | Stored by key. `iconLabel(key)` and `iconGroupLabel` word them; icon search matches English and the user's language. |
| Calendar revision reasons (`definition_revisions.reason`) | The server stores English ("Definition change", "Before restoring version n"…). `revisionReason` in `components/calendars/revision-reason.ts` words the known ones; anything else shows as stored. |
| Moon phase presets (`EIGHT_PHASES`, `FOUR_PHASES`, `ONE_PHASE`), default state "Visible", "Phase n"/"State n" | Names are getters worded in the active language, so a new moon is seeded in it; after that they are user content. The phase preview finds the full moon by /full|cheia/. |

## Glossary (pt-BR)

Use the vocabulary of the pt-BR D&D 5e books. Keep it consistent across batches, and extend this table when a batch settles a new term.

| en-US | pt-BR |
|---|---|
| World | Mundo |
| Map | Mapa |
| Layer | Camada |
| Marker | Marcador |
| Zone | Zona |
| Route | Rota |
| Legend | Legenda |
| Scale bar | Barra de escala |
| Article | Artigo |
| Person / People | Pessoa / Pessoas |
| Calendar | Calendário |
| Season | Estação |
| Campaign | Campanha |
| Session | Sessão |
| Quest | Missão |
| Front | Front |
| Plot thread | Trama |
| Relationship board | Quadro de relações |
| Settings | Configurações |
| Trash | Lixeira |
| Delete forever | Excluir para sempre |
| Sub-map | Submapa |
| Units & formats | Unidades e formatos |
| Shortcut | Atalho |
| Board (articles view) | Quadro |
| Family tree | Árvore genealógica |
| Writer | Escritor |
| Badge (world) | Emblema |
| Advanced Tools | Ferramentas Avançadas |
| Character On Demand | Personagem Sob Demanda |
| Weather Generator | Gerador de Clima |
| Undo | Desfazer |
| Folder | Pasta |
| Parent map / Child map | Mapa pai / Mapa filho |
| Root (of the maps tree) | Raiz |
| Map artwork | Arte do mapa |
| Ungrouped | Sem pasta |
| Mixed (differing values) | Misto |
| Grid | Grade |
| Scene (panel) | Cena |
| Redo | Refazer |
| Region (zone folder) | Região |
| Fill / Outline | Preenchimento / Contorno |
| Brush / Eraser | Pincel / Borracha |
| Territory | Território |
| Scale & measure | Escala e medição |
| Pace (travel) | Ritmo |
| League (unit) | Légua |
| Label (legend item) | Rótulo |
| Calibrate | Calibrar |
| Ownership (marker tag) | Domínio |
| Status (marker tags) | Situação |
| Fiend | Corruptor |
| Appearance / Look | Aparência |
| Affiliation | Afiliação |
| Hierarchy profile | Perfil de hierarquia |
| Authority (territory) | Autoridade |
| Duchy / County / Barony | Ducado / Condado / Baronato |
| Shire | Comarca |
| Coat of arms / Crest | Brasão |
| Title (block style) / Heading n | Título principal / Título n |
| Secret (editor block) | Segredo |
| Table of contents | Sumário |
| Caption | Legenda |
| Caret | Cursor |
| Weekday | Dia da semana |
| Leap day / Leap rule | Dia bissexto / Regra bissexta |
| Epoch | Época inicial |
| Record (calendar entry) | Registro |
| Note / Event | Nota / Evento |
| Celestial object / Sky | Objeto celeste / Céu |
| Preview | Prévia |
| Revision / Earlier versions | Versão / Versões anteriores |
| Phase (moon) / State (celestial) | Fase / Estado |
| Override (celestial special date) | Data especial |
| Season profile | Perfil de estação |
| Hook (quest status) | Gancho |
| Objective / Sub-quest | Objetivo / Submissão |
| Quest giver | Contratante |
| Secrets & clues / Clue | Segredos e pistas / Pista |
| Grim portents / Impending doom | Presságios sombrios / Desgraça iminente |
| Progress clock / tick | Relógio de progresso / marca, marcar |
| Reward / Loot | Recompensa / Espólio |
| Party stash | Estoque do grupo |
| Milestone (no XP) | Marco |
| Retired (character) | Aposentado |
| Copper/silver/electrum/gold/platinum piece | Peça de cobre/prata/electro/ouro/platina (pc, pp, pe, po, pl) |
| Outline / Arc / Chapter / Scene | Estrutura / Arco / Capítulo / Cena |
| Promise / Setup (Chekhov) / Payoff | Promessa / Preparação (Tchekhov) / Desfecho |
| MICE thread (Milieu, Inquiry, Character, Event) | Trama MICE (Ambiente, Investigação, Personagem, Evento) |
| Lines and Veils / Session zero / Strong start | Limites e Véus / Sessão zero / Início forte |
| NPC | PdM |
| Relation type labels (Parent of / Child of, Liege of / Vassal of…) | Genitor de / Filho de, Suserano de / Vassalo de… (generic masculine where Portuguese has no neutral form) |
| Tie (relationship) | Vínculo |
| Board (relations) | Quadro |
| Drizzle / Sleet / Gust | Garoa / Chuva com neve / Rajada |
| Weather report | Boletim do clima |

## Batches

Large batches (3, 4, 8, 10) can be split into sub-batches of about 8–12 files. Record the split here.

- [x] **0. Foundation:** `src/i18n/*`, `<html lang>`, metadata, `SettingsProvider` save error, `GeneralSettings`, month names in `date-format.ts`, `LOCALIZED_GLOBS`, `tests/i18n.test.ts`.
- [x] **1. Shell and shared primitives:** `AppNav`, `Modal`, `ConfirmDialog`, `Skeleton`, `LoadingScreen`, `SearchBox`, `DatePicker`, `IconPicker`, `Toggle`, `ToolSection`, `components/worlds/*`, `app/worlds/page.tsx` (metadata), `src/proxy.ts` messages.
- [x] **2. Settings, trash, import/export:** the rest of `components/settings/*` (`TrashView`, `FormatSettings`, `SettingsNav`, `parts`), `server/trash/list.ts` fallbacks, `components/shortcuts.ts`, `settings.ts` `sanitizeSettingsPatch` errors, `api/settings`, `import-export.ts` errors, `api/export`, `api/import`.
- [x] **3. Maps A, workspace:** `MapWorkspace`, `MapViewer` (alerts, "Processing failed"), `LayerFolders`, `components/maps/*`, `seed-categories.ts`, default "Layer n"/"Zone n"/"New marker"/"New text", `api/maps/**` errors.
  - [x] **3a.** Maps list: `components/maps/*`, `MapManager`, `LayerFolders`, `seed-categories.ts`, `folderMoveError`.
  - [x] **3b.** `MapWorkspace`, `MapViewer`, default names ("Layer n", "Zone n", "New marker", "New text").
  - [x] **3c.** `api/maps/**`, `api/map-folders/**`, `api/map-categories` errors.
- [x] **4. Maps B, panels and HUD:** `ZonesPanel`, `TextPanel`, `LinePanel`, `map-hud/*`, `marker-panel/*`, `server/markers/icon-registry.ts`, `travel.ts` `formatDuration`, `scale/area.ts`, `units.ts` labels, `api/markers`, `api/zones`.
  - [x] **4a.** `ZonesPanel`, `TextPanel`, `LinePanel`.
  - [x] **4b.** `map-hud/*`, `travel.ts` `formatDuration`, `scale/area.ts`, `units.ts` labels.
  - [x] **4c.** `marker-panel/*`, `icon-registry.ts`, `api/markers`, `api/zones`.
- [x] **5. Politics:** politics components, `PoliticalReferencesPanel`, `hierarchy-config.ts` display labels, `politics/seed.ts`, `relations/validate.ts`, `api/politics/**`.
  - [x] **5a.** UI and labels: `hierarchy-config.ts` label helpers, `politics/seed.ts`, `HierarchyProfiles`, `TypeSelect` (in `articles/shared.tsx`), `TerritoryTree`, `PoliticalReferencesPanel`, `PortraitUploader`, territory types in `ZonesPanel`.
  - [x] **5b.** Server: `relations/validate.ts`, `server/politics/*` errors (`validateChain`, `links.ts`, `queries.ts`), `api/politics/**`, `api/markers/[markerId]/affiliation`.
- [x] **6. Rich editor:** `components/rich-editor/*`, `RichEditor.tsx`, placeholders passed by its callers, `documents/schema.ts` errors.
  - [x] **6a.** `RichEditor`, `BubbleMenus`, `SlashMenu`, `TableMenus`, `MentionMenu`, `TableOfContents`, `ArticleLinkModal`, `colors.ts`.
  - [x] **6b.** `CalendarDateModal`, `ImageLightbox`, `ReadOnlyRich`, `calendar-date.tsx`, `extensions.ts`, `images.ts`, `mention.ts`, `secret.ts`, `tables.ts`, `toc.ts`, `documents/schema.ts` errors, placeholders passed by the callers.
- [x] **7. Articles A, UI:** `components/articles/*` (`InfoBar`, `templates.ts` `TEMPLATE_LABELS`), `api/articles`, share page (`app/share/[token]`, `server/share/load.ts`, `components/share/*`).
  - [x] **7a.** Templates and lists: `templates.ts`, `shared.tsx`, `ArticlesSidebar`, `ArticlesManager`, `CreateArticleModal`, `DeleteArticleButton`, `ArticleFoldersControl`, `ArticleFoldersTree`, `ArticleFolderView`, `TagEditor`, `article-folders.ts`, `quick-create.ts`, Trash subtypes.
  - [x] **7b.** Article screens: `ArticleView`, `GenericArticle`, `CharacterArticle`, `OrganizationArticle`, `TerritoryArticle`, `ArticleMapPresence`, `InfoPicker`, `InfoBar` (with the politics label helpers from 5a).
  - [x] **7c.** `api/articles/**`, `api/article-folders/**`, `api/article-images/**`, `api/share/**`, `api/shares/**`, share page (`app/share/[token]`, `server/share/load.ts`, `components/share/*`).
- [x] **8. Articles B, info-sets:** `server/articles/info-sets/*` (27 files: field labels, hints, option display map), `info-fields.ts`.
- [x] **9. Calendars:** `components/calendars/*`, `calendars/parse.ts`, `engine.ts`, `celestial.ts` (phases seeded in the active locale), `impact.ts`, `respond.ts`, `api/calendars/**` including "(copy)".
  - [x] **9a.** Shell and definition: `CalendarsManager`, `CalendarsSidebar`, `CalendarEditor`, `CalendarViews`, `DefinitionFields`, `DefinitionPreview`, `DateInput`, `WorldDatePicker`, `RevisionsList`, `ImpactDialog`, `FoldSection`, `view-parts`, `evaluate.ts`, `api.ts`, `parse.ts`, `engine.ts`, `impact.ts`, `respond.ts`, `api/calendars/**`.
  - [x] **9b.** Days and entries: `DayDetails`, `EntryEditor`, `RecurrenceBuilder`, `ArticleLinksSection`, `CalendarBacklinks`, `entries.ts` and `recurrence.ts` messages, `api/calendar-entries/**`, `api/chronology`.
  - [x] **9c.** Celestial and seasons: `CelestialEditor`, `CelestialSections`, `CelestialView`, `celestial.ts`, `celestial-types.ts`, `ProfilesEditor`, `SeasonsEditor`, `SeasonView`, `season-parts`, `profile-lookup.ts`, `profiles.ts` and `seasons.ts` messages (then `impact.ts` passes the season issue as a Problem), `api/celestial/**`, `api/seasons/**`, `api/season-profiles/**`, `api/definition-revisions/**`.
- [x] **10. Campaign:** `quests/*`, `sessions/*`, `writer/*`, `relations/*`, `campaign/*`, the `types.ts` label maps, `writer/templates.ts`, the `parse.ts` errors, `api/campaigns`, `quests`, `sessions`, `writer`.
  - [x] **10a.** Quests and fronts: `components/quests/*`, `server/quests/types.ts` labels, `parse.ts`/`fields.ts` errors, `map.ts`, `api/quests/**`, `api/fronts/**`, `api/campaigns/[id]/quests|fronts|quest-map`.
  - [x] **10b.** Sessions and campaign: `components/sessions/*`, `components/campaign/*`, `server/sessions/*`, `api/sessions/**`, `api/campaigns` (list, `[id]`, characters), `app/(campaign)` metadata.
  - [x] **10c.** Writer: `components/writer/*`, `server/writer/*` (`templates.ts`, `guides.ts`, `parse.ts`), `api/campaigns/[id]/outline|threads|status-log|writer-health`, `api/outline/**`, `api/threads/**`, `api/status-log/**`, share `NODE_KIND_LABELS`.
    - [x] **10c1.** Server, data and routes: `server/writer/*` (`types.ts` labels and hints, `guides.ts`, `templates.ts`, `parse.ts`, `fields.ts`, `logic.ts`), the writer routes, share `NODE_KIND_LABELS`.
    - [x] **10c2.** `components/writer/*`.
  - [x] **10d.** Relations and mentions: `components/relations/*`, `server/relations/*` labels (relation type names in errors), `api/relations/**`, `api/relation-boards/**`, `server/mentions/*` group and backlink types.
    - [x] **10d1.** Server, data, mentions and routes: `server/relations/types.ts` (types, groups, derived kinds), `graph.ts`, `store.ts`, `validate.ts`, `server/mentions/store.ts`, `api/relations/**`, `api/relation-boards/**`.
    - [x] **10d2.** `components/relations/*`.
- [x] **11. Tools, weather:** `src/lib/weather/*` (codes instead of English text, labels at render time, legacy days shown as-is), `DayWeather`, `WeatherGenerator`, `WeatherModal`, `server/calendars/weather.ts`.
- [x] **12. Tools, character on demand:** `lib/character-on-demand/*` (`GENDERS`/`BACKGROUNDS` keys, pt-BR backstory grammar with gender agreement), `server/character-on-demand/document.ts`, `api/tools/character-on-demand/**`, tools UI, `RecentList`.
  - [x] **12a.** Labels for the stored values (gender, species, hairstyle, beard, hair color), `CharacterOnDemand`, `CharacterModal`, `ToolsNav`, `server/character-on-demand/document.ts`, `api/tools/character-on-demand/**`.
  - [x] **12b.** pt-BR backstory: grammar with gender agreement and pt-BR tables for `backstory/shared.ts` and the 16 backgrounds; the backstory is rolled in the active language.
- [x] **13. Sweep:** remaining root `src/components/*.tsx`, `spike`, worker `lastError` mapping. Widen `LOCALIZED_GLOBS` to all of `src/components/**` and `src/app/**`.
  - [x] **13a.** Map sidebar and layers: `MapSidebar`, `LayersPanel`, `LayerChecklist`, `LayerImageDialog`, `ImageCropDialog`, `GridPanel`, `ScenePanel`, `MapSettingsModal`, `ColorWheel`, `FontPicker`.
  - [x] **13b.** Markers and the rest: `MarkersPanel`, `MarkerPanel`, `MarkerLinksPanel`, `MarkerArticlesPanel`, `MarkerHoverCard`, `MarkerSectionStrip`, `MentionBacklinks`, `DescriptionSection`, `ScrollToTopButton`, `LineLayer`, `TextLayer`, `MapSpike`, `app/spike`.
  - [x] **13c.** Remaining API routes (layers, lines, routes, texts, zone-regions, tiles, thumbnails, assets, relation boards) and `server/maps/folder-routes.ts`, worker `lastError`, the app title, `.ts` helpers in `src/components`; widen `LOCALIZED_GLOBS`.

## Batch log

- **0** (2026-10-08): foundation in place. Only `common` and `settings` (General card) are translated. Month names in `formatRealDate` follow the language.
- **1** (2026-10-08): done in one pass (15 small files). New namespaces `nav`, `tools`, `worlds`, `errors`. Also covered: `WorldDateLabel`, `tools/tools.ts` labels (now with `id`), `api/worlds/**`, `server/world/worlds.ts` validator, `guards.ts` `foreignIdResponse` (now async; its 9 callers already `return` it). `Skeleton.tsx` became `"use client"` because it now uses `useT`. `DatePicker` month, weekday and day names come from `Intl` (weekdays now 3 letters, e.g. "Sun"/"dom."). Left in English on purpose: `src/proxy.ts` messages (403s only reach non-local or cross-origin requests; the 409 `noWorld` reply makes the client redirect without showing its text) and the brand "World Wiki" (allowed in the lint rule).
- **2** (2026-10-08): done in one pass (about 17 files, most small). New namespaces `trash`, `shortcuts`; more `settings` and `errors` keys. `shortcuts.ts` is now a catalog of message keys, worded by `localizeShortcutGroups(groups, t)`; mouse key caps (Click, Drag, Wheel…) are translated, keyboard keys are not. `SETTINGS_SECTIONS` items have an `id` instead of English labels. `sanitizeSettingsPatch` returns `{ error: "invalidSettingValue", setting }` (tests updated). Trash purge skip reasons are structured (`SkipReason`) and worded by `describePurgeResult`. Left for later: article template subtypes in the Trash list ("Character", from `TEMPLATE_LABELS`, batch 7); the sample in-world date "12 Alder 1024 AR" in Formats stays as made-up names.
- **3a** (2026-10-08): batch 3 split into 3a/3b/3c (about 34 files). New namespace `maps`; more `common` (`serverUnreachable`, `yes`, `done`…) and `errors` keys. `MapManager` (the Maps page, not named in the plan) is included. `LayerFolders` `noun` is now typed `FolderNoun` (`zone`/`line`/`text`/`route`); its words come from `maps` `noun.*`, and pt-BR sentences avoid gender agreement ("o conteúdo", "tudo", "itens"). Map image states show via `assetStateLabel`. `folderMoveError` returns an `errors` key; the map-folder and article-folder routes translate it. Seeded map categories use the active locale. Left for their batches: other strings in the folder routes (3c, 7) and the `noneLabel`/`hint` props passed in by the panels (batch 4).
- **3b** (2026-10-08): `MapWorkspace`, `MapViewer`. Undo labels are worded when recorded (`undo.*` plus `noun.*`), so history made before a language switch keeps its old language. Paste failures have one message per kind (gender). Default names now follow the active locale: "Layer n" (`createDefaultLayer`, `api/maps/[mapId]/layers`), "Zone n" (`api/maps/[mapId]/zones`), "Region 1", "New marker", "New text". New `allTranslations(ns, key)` in `translate.ts` (with a test): `MarkerSubject` (batch 4) uses it to recognize the default marker name in any language; its other English text stays for batch 4. Panel loading titles (`maps` `panel.*`) are ready for the batch 4 panels to reuse. `job.lastError` is shown as stored (batch 13).
- **3c** (2026-10-08): `api/maps/**`, `api/map-folders/**`, `api/map-categories` errors through the new `errorResponse`. Shared sources converted once for every caller (approved): `notInWorld` takes an errors key (73 calls in 42 files, other batches included); `InvalidImageError` (`server/assets/validate.ts`, `receive-upload.ts`) and `InvalidReparentError` (`maps/hierarchy.ts`) carry `key`/`params` like `ImportValidationError`, so the map, layer, article and portrait image routes now answer in the user's language; `folderError` (`maps/layer-folders.ts`) returns a key, which also covers `api/lines|texts|routes/[id]`. Server modules that tests import use relative `../../i18n/...` imports (vitest has no `@/` alias). Left for batch 7: the other strings in `api/article-folders/[id]`.
- **4a** (2026-10-08): batch 4 split into 4a/4b/4c (about 40 files). `ZonesPanel`, `TextPanel`, `LinePanel`. Keys shared by the three tool panels are in `maps` `panel.*` and `style.*`; each tool has `zones.*`, `text.*` or `lines.*`. In `TextPanel` the translator is `tm`, because `t` is a text there. Option catalogs (line styles and caps, text alignments) are now plain ids, labeled when rendered. The placeholder names "Line n" (`lineLabel`) and "Text" are display-only and use `activeT`. Lock messages and "New … go into" have one key per tool, for gender. Left for batch 5: territory types shown as `(type)` in the zone territory picker. `SliderField`, `FontPicker`, `ColorWheel` and `LayerChecklist` text stays for batch 13.
- **4b** (2026-10-08): `map-hud/*` (legend, scale and measure, area, travel, scale bar, legend widget, the HUD hooks). Ways of travel, paces, groups, scale styles and tones, legend sizes and area tools are ids labeled when rendered (`maps` `travel.*`, `scale.*`, `legend.*`, `area.*`). `formatDuration` (`travel.ts`), unit names (`scaleUnitLabel` replaces `SCALE_UNIT_LABELS`, plus `unitSuffix` in `scale-config.ts`, square units in `area.ts`) and `units.ts` (`mph`, `ft.`, the "e.g." of measure examples) use `activeT` with relative imports, so they stay pure for tests. Metric and imperial symbols (km, mi, kg, lb, km², ft²…) are the same in both languages. "Route n" placeholders are display-only. The wagon and flying-mount notes in `TRAVEL_MODES` aren't shown anywhere, so they stay English.
- **4c** (2026-10-08): `marker-panel/*`, `icon-registry.ts`, `tag-registry.ts`, `api/markers/**`, `api/zones/**`. New namespace `icons`: en-US was generated from the registry, pt-BR was drafted by a Sonnet subagent and spot-checked. `IconPicker` (batch 1) now uses `iconLabel` and `iconGroupLabel`. A duplicated marker is named "{name} (copy)" in the active locale (worded before the transaction). Left for later: `api/markers/[markerId]/affiliation` (politics, batch 5); article template labels shown in the marker panel (`templateOf().label`, batch 7); `MarkersPanel`/`MarkerPanel`/`MarkerSectionStrip` (root components, batch 13).
- **5a** (2026-10-08): batch 5 split into 5a/5b (about 30 files). New namespace `politics`. `hierarchy-config.ts` has label helpers for every stored catalog (territory types, government forms, organization kinds, person statuses, authority roles) plus `hierarchyProfileName`; they use `activeT` by default and take a translator. The articles batches (7, 8) call them for the rest of the screens. The seeded "Default" profile keeps its stored name and gets its description in the active locale. `PortraitUploader` sentences take the lowercased `label` the caller passes (callers are batch 7); pt-BR wording avoids articles so any noun fits. `TypeSelect` in `articles/shared.tsx` is translated, but that file joins `LOCALIZED_GLOBS` in batch 7. `suggestedTitle` and `placementGuidance` in `TERRITORY_TYPE_CATALOG` aren't shown anywhere, so they stay English. pt-BR person statuses use the masculine form ("Vivo", "Falecido").
- **5b** (2026-10-08): about 25 files. Every error reply in `api/politics/**`, `api/markers/[markerId]/affiliation` and `portrait-routes.ts` goes through `errorResponse`. `validateChain` returns `{ valid: false, error: { key, params } }` with territory types as stored; the new `server/politics/chain-errors.ts` (`chainErrorResponse`, `chainErrorText`) words them in the user's language. `validateRelation` returns an `errors` key, and `RelationError` carries `key`/`params`; all 7 routes that catch it were converted once, including `api/relations/**` (batch 10) and `api/articles/[id]` (batch 7). `errorResponse` no longer formats `count`, so plural errors work (`territoryHasChildren`). The marker link `source` labels (`links.ts`) and "Unknown territory" (`queries.ts`) are worded on the server with `serverT`. Left for batch 10: relation type names in relation errors still use the English `type.label`. The `"Noble House"` default organization kind is a stored value, not text.
- **6a** (2026-10-08): batch 6 split into 6a/6b (about 21 files). New namespace `editor`. Block styles, slash items and image alignments word their labels when rendered (`label: (t) => …` or an `editor` key). The / menu matches the label in the user's language and in English, so "/table" and "/tabela" both work. Markdown shortcuts show as "{key} space" (`spaceKey`). `TEXT_COLORS` labels are typed English names that double as `color.*` keys and search words. `TableMenus` `Stepper` takes `kind` (`rows`/`cols`) instead of label strings. The editor placeholder is worded when the editor is created (once per document). Left for batch 7: article template names and plurals (`templateOf().label`, `.plural`) in `ArticleLinkModal`. Left for batch 10: the group names in @ mention results, which come from `/api/mentions/search`.
- **6b** (2026-10-08): `CalendarDateModal`, `ImageLightbox`, `images.ts` and `secret.ts` (both with `activeT`), `documents/schema.ts`, `api/documents/[documentId]`. `DocumentValidationError` carries `key`/`params`; its 29 messages are `errors` `doc*` keys. The `editor` `placeholder.*` keys cover the literal placeholders passed by `DayDetails`, `QuestEditor`, `QuestView`, `SessionEditor` and `SessionView`. Only those props changed; the rest of those files waits for batches 9 and 10. `LOCALIZED_GLOBS` now covers all of `rich-editor/**`. Left for later: `ArticleView` passes its placeholders as variables (batch 7); in an import, a bad document's `reason` stays in English inside the translated `importDocumentInvalid` message.
- **7a** (2026-10-08): batch 7 split into 7a/7b/7c (about 40 files). New namespace `articles` (24 templates × label/plural/description, plus the list UI). `ARTICLE_TEMPLATES` entries word `label`, `plural` and `description` on read, so the roughly 30 places that show them (relations, marker panel, editor link dialog, sessions…) follow the language without edits. The Trash list words article subtypes with `templateLabel` (left over from batch 2). The pt-BR "Delete this {kind}?" family reads "Excluir este artigo ({kind})?" to avoid gender agreement. Left for batch 10: `server/mentions/store.ts` group and backlink types ("Quest", "Session recap").
- **7b** (2026-10-08): `ArticleView`, `GenericArticle`, `CharacterArticle`, `OrganizationArticle`, `TerritoryArticle`, `ArticleMapPresence`, `InfoPicker`, `InfoBar`. They now use the 5a politics helpers: territory types (subtitle, parent picker, breadcrumb groups, missing types), organization kinds (subtitle, folder groups), person statuses (folder groups), authority roles (role select, lists) and `hierarchyProfileName`. Card words are `articles` `card.<variant>.*` and field-kind hints `info.kind.*`. `InfoForm` `saveLabel`/`savingLabel` now fall back to `common` save/saving. In `CharacterArticle`, "{role} of {territory}" is split around the territory button. `→` and `›` joined the lint's allowed punctuation. Left for batch 8: field labels, hints, group names and select option values in the Info Bar (they come from `info-sets`).
- **7c** (2026-10-08): every error reply in `api/articles/**`, `api/article-folders/**` (finishing what 3c left), `api/article-images/**`, `api/share/**` and `api/shares/**` goes through `errorResponse`. `ShareDialog` and `ShareView` use `articles` `share.*`. The share page is in the owner's language, because `SettingsProvider` wraps it like every other page. `server/share/load.ts` words `templateLabel` with `serverT`. The page title "Link unavailable" comes from `generateMetadata`. Left for batch 10: `NODE_KIND_LABELS` in the shared story and the scope labels the writer passes ("Whole campaign", "Chapter: …").
- **8** (2026-10-08): no sub-batches. The 27 data files didn't change. `info.json` (2039 keys: 570 fields, 88 groups, 648 hints, 733 options) was generated from the registry; 47 hints worded differently per template have `hint.<template>.<key>`. pt-BR was drafted by 2 Sonnet subagents (labels, groups and options; hints), checked for keys, placeholders and encoding, and spot-checked. The Info Bar shows options with `optionLabel` and sorts the add menu by the label in the user's language (the data files sort by English). The Articles sidebar search detail uses the politics labels. New test in `tests/i18n.test.ts`. Known pt-BR caveats: option adjectives have one gender ("Ativa", "Dissolvida" fit Organização); "Town" is "Cidade pequena"; campaign-specific backgrounds are free renderings, not official names.
- **9a** (2026-10-08): batch 9 split into 9a/9b/9c (about 35 files). New namespace `calendars`. Calendar errors are a `Problem` (`calendars` key plus params, a param can be another Problem) defined in `engine.ts`: `problemText(problem, t)` words it, with `activeT` on the client and `problemWords` (`serverT`) in routes. `CalendarError` is now the base of `ParseError`, `RecurrenceError`, `InvalidError`, `ReviewError` and `StaleError`; its `message` stays English (logs, tests) and `calendarErrorResponse` (now async) answers in the user's language. `dateError` still returns a string (active language); `dateProblem` returns the Problem. `DefinitionIssue` and impact `references`/`named.error` carry Problems. Default names ("Weekday n", "Month n", "Festival", "Leap day") and "(copy)" use the active or user's language when created. `AgendaView` takes `emptyText` instead of `rangeLabel`. The 📜 and ⏳ chip icons joined the lint `allowedStrings`. Left in English on purpose: `parse.ts` shape errors ("… must be a list", only malformed requests reach them), the "Unreachable: …" internal errors, and the `(…)` label `safeLabel` shows for a date outside the supported year range. quests/sessions/writer parsers still throw `ParseError` with English text (batch 10).
- **9b** (2026-10-08): `describeRecurrence` takes an optional translator (active language by default, like the other pure helpers). `ENTRY_KINDS` `label`/`detail` are getters worded on read. `entries.ts` and `recurrence.ts` messages are Problems; `entries.ts` "… must be a whole day number" is a shape error and stays English. Every error reply in `api/calendar-entries/**` and `api/chronology` goes through `errorResponse` (new `errors` keys; `articleLinkedToDay` is separate from the markers' `articleAlreadyLinked`). pt-BR condition rows read "quando valem [todas | qualquer uma] destas condições:". Quest day and status labels in `DayDetails` and `CalendarViews` (`QUEST_DAY_LABELS`, `QUEST_STATUS_LABELS`) are batch 10.
- **9c** (2026-10-08): `CELESTIAL_TYPES` `label`/`plural`/`detail` are getters. `celestialIssues` returns Problems and `ProfileIssue` carries `problem` (plus `message` in the active language); `impact.ts` passes the season issue as a nested Problem. `profiles.ts` messages are Problems; the "A season"/"Untitled event" fallbacks use `serverT`. `ruleSummary`, `seasonLength` and the profile lookup use `activeT`. Every error reply in `api/celestial/**`, `api/seasons/**`, `api/season-profiles/**` and `api/definition-revisions/**` goes through `errorResponse`. Calendar keys for the celestial rules are `sched.*` (9a already had `rule.*` for leap rules). ✦ joined the lint `allowedStrings`. Revision reasons stay stored in English (see the rules table).
- **10a** (2026-10-08): batch 10 split into 10a–10d (about 100 files). New namespace `campaign`. The quest label maps in `server/quests/types.ts` (statuses, kinds, priorities, link roles, log actions, front kinds and statuses, quest days, plus the new `OBJECTIVE_STATE_LABELS`) are getters worded on read (`wordedLabels`), so `DayDetails`, `CalendarViews` and `SessionView` follow the language without edits. `Problem` (`calendars/engine.ts`) now takes `ns: "campaign"`, and `problemText(problem, locale?)` takes a locale instead of a translator; `problemWords` passes `serverLocale()`. The quest parsers throw `campaign` Problems for what a user can run into (title, end/deadline before start, reward coin and numbers, parent and front checks); shape errors stay English like 9a. Quest board columns word their label on read. Every error reply in `api/quests/**`, `api/fronts/**` and `api/campaigns/[id]/quests|fronts|quest-map` goes through `errorResponse` (`campaignNotFound` is ready for 10b). ✓ joined the lint `allowedStrings`. New tests in `tests/i18n.test.ts`. Left for 10b: the rest of `SessionView`/`SessionEditor` and the `api/campaigns` routes.
- **10b** (2026-10-08): `components/sessions/*`, `components/campaign/*`, `server/sessions/*`, `api/sessions/**`, `api/campaigns` (list, `[id]`, characters). `D_AND_D_COINS` became `dndCoins(t?)`: a new campaign's coins are named in the user's language (pt-BR PHB abbreviations pc, pp, pe, po, pl) and are user content after that; the "Use D&D coins" button uses the active language. `STATUS_LABELS` (roster) are getters, `sessionLabel` and `recipientName` use `activeT`. The session parsers throw `campaign` Problems like 10a, and "Session n already exists" is one too. Every error reply in those routes goes through `errorResponse` (campaign delete blockers are plurals). `SessionView` groups linked articles with `templateLabel` instead of the English `TEMPLATE_LABELS`. `app/(campaign)` pages have no metadata, so nothing to word there. The Sessions header joins its counts with " · " (one message per count). Left for 10c: the Writer dialogs that open from a session (`SessionPrepDialog`, `SessionReviewDialog`).
- **10c1** (2026-10-08): batch 10c split into 10c1 (server, data, routes) and 10c2 (`components/writer/*`). New namespace `writer` (about 230 keys): en-US was generated from the old English data (`types.ts` maps, `guides.ts`, `templates.ts`), pt-BR drafted by a Sonnet subagent and spot-checked (Story Circle hints made gender-neutral). The data files keep keys and numbers only; labels, hints, guide items, tips and the six story structures are worded on read through the new `src/i18n/worded.ts` (`wordedLabels`, `wordedFields`, also used now by `server/quests/types.ts`). `templateChildren`, `healthWarnings`, `checkMoves` and `nestError` take a `writer` translator (active language by default); the routes pass `serverT("writer")`, so a structure applied from the API seeds its beats in the user's language (then they are user content). Writer parse and field errors are `campaign` Problems; every error reply in the writer routes goes through `errorResponse`. Health warning quotes changed from "…" to “…” in en-US too. `ShareView` and `server/mentions/store.ts` read `NODE_KIND_LABELS` unchanged; the mentions one runs on the server, where the active language is the default, so it waits for 10d.
- **10c2** (2026-10-08): `components/writer/*` (15 files) use `writer` `ui.*`, `tab.*`, `node.*`, `threads.*`, `prep.*`, `review.*`, `sessions.*`, `setup.*` and friends. Sentences that name an outline kind have one key per kind (`addKind.*`, `addKindTo.*`, `deleteKind.*`, `childrenOf.*`, `hiddenVia.*`, `templatePicker.adds.*`, `share.hiddenSelf.*`), so pt-BR agrees in gender (arco/capítulo masculine, cena feminine). New outline items are titled "New arc/chapter/scene" in the active language when created (then user content). Share scope labels and warnings are worded with `activeT` (they're built outside the component). `ROLE_MARK` symbols (● ◐ ★) and "MICE" stay as they are. The health panel refetches when the language changes, so its server-worded warnings follow it.
- **10d1** (2026-10-08): batch 10d split into 10d1 (server, data, mentions, routes) and 10d2 (`components/relations/*`). New namespace `relations`: en-US generated from the registry (`RELATION_TYPES`, `RELATION_GROUPS`, `DERIVED_KINDS`), pt-BR written by hand. Relation types word `label`/`inverseLabel` on read (`wordedFields`), groups too; the English in the registry stays as the en-US source. `derivedLabel(key)` words derived ties ("Member of house", "Vassal of", "Capital of"). `validateRelation` now passes the type *key* in error params; the new `relationErrorResponse` (`server/relations/respond.ts`) names the type in the user's language, and all 7 routes that catch `RelationError` use it. `serverDerivedEdges(worldId, locale)` words seat ties and ruler roles (`authorityRoleLabel`) in the user's language. `server/mentions/store.ts` words @-mention groups and backlink types with the user's locale (`templateLabel`, `writer` `nodeKind.*`, `campaign` `session.label*`), which also fixes the English groups left from 6a and 7a. Board shape errors ("Cards must be a list.") stay English.
- **10d2** (2026-10-08): `components/relations/*` (11 files) use `relations` `ui.*`, `web.*`, `family.*`, `boards.*`, `card.*`, `canvas.*`, `legend.*`. The pickers group articles with `templateLabel` (and plurals from `ARTICLE_TEMPLATES` in the family tree) instead of the English `TEMPLATE_LABELS`. Parent kinds and spouse statuses get labels (`parentKind.*`, `spouseStatus.*`) instead of the capitalized stored value. A new board is named "Board n" in the active language (then user content); note colors are ids worded on render. The other-end reading of a seat tie compares with `derivedLabel("capital")`, because the server now sends the label in the user's language. Edge labels on the canvas ("Secret · …") and the inspector's "(by)" use `activeT`. Batch 10 is done.
- **11** (2026-10-08): new namespace `weather`. The generator now stores codes: `sky`, `precipitationLabel`, `label` (`sky.*`, `precip.<type>.<intensity>[.thunder]`) and effect texts (`effect.*`) are `weather` keys. `src/lib/weather/labels.ts` words them on display (`weatherText`; a value that isn't a key, from a day saved before, shows as stored) and words the stored English enums: climate, season, geography, time of day and compass point (`climateLabel`…`directionLabel`). Wind force is shown from the `beaufort` number (`beaufortLabel`), so older days are worded too; `windForce` and `BEAUFORT` keep the English. `daySummary` takes a translator. `RecentList` (shared with Character On Demand) words its sentences through `tools` `recent.*` with the caller's noun; Character On Demand still passes an English noun until batch 12. Every error reply in `api/calendar-weather/**` goes through `errorResponse`. `server/calendars/weather.ts` had no text. `src/lib/weather/labels.ts` uses relative imports because vitest doesn't resolve `@/` there.
- **12a** (2026-10-08): batch 12 split into 12a (labels, UI, article, route) and 12b (pt-BR backstory, about 20 files of word tables). New namespace `character`. A generated character keeps storing English values (gender, hairstyle, beard, hair color) and species keys, because the article route checks them against the tool's lists; `lib/character-on-demand/labels.ts` words them on display (`genderLabel`, `speciesLabel`, `beardLabel`, `hairLabel`; a value from an older list shows as stored), and backgrounds use the `info` `optionLabel`. The Character article is written in the user's language: headings, detail labels and values, and the Gender and Hair fields (text fields, so user content after that); Social Background keeps its stored English option. `buildCharacterDocument` takes a `character` translator. `ToolsNav` words the tool names from `tools` (`TOOLS` `label`/`description` and `SPECIES` `label` stay as the English source). Every error reply in `api/tools/character-on-demand/**` goes through `errorResponse`. `LOCALIZED_GLOBS` now covers all of `src/components/tools/**`. The backstory text is still English in every language until 12b.
- **12b** (2026-10-08): pt-BR backstory tables live in `backstory/pt-BR/` (`shared.ts`, `backgrounds/*`, `backgrounds/common.ts`), drafted by two Sonnet subagents and reviewed (definite articles in `relation`/`item` entries replaced, a few agreements and fears reworded). `generateBackstory` takes a locale (the active language by default) and `tablesFor(background, locale)` picks that language's tables; the backstory is written in that language when rolled and kept as is. The grammar gained `{masculine|feminine}` alternatives chosen by the character's gender; pt-BR tables use them instead of the English pronoun slots (the subject is dropped). pt-BR writing rules: `relation`/`item` entries take an indefinite article or a possessive, so prepositions before them never contract; `place` entries are locative phrases ("no velho moinho"); `condition` agrees with "a roupa", since the pt-BR appearance reads "Usa {garment}; a roupa está {condition}. Traz {accessory}.". Tests check every language expands cleanly, has the same tables and entry counts as en-US, and the gender alternatives. Batch 12 is done.
- **13a** (2026-10-08): batch 13 split into 13a (map sidebar and layers, 10 files), 13b (markers and the remaining root components, `spike`) and 13c (remaining API routes, worker `lastError`, app title, `.ts` helpers, widening `LOCALIZED_GLOBS`). New `maps` keys `rail.*` (tool rail), `layers.*`, `layerImage.*`, `grid.*` (shapes worded by key; `GRID_SHAPES` labels stay as the English source), `scene.*`, `checklist.*`, `mapForm.*`; `common` gained `crop.*` (`ImageCropDialog`, whose `confirmLabel` now defaults to `crop.save`), `color.*` and `font.label`. Scene sections take a `group` and have one hide/show message per group (gender: zonas/linhas/rotas are feminine). The Scene panel's line and route placeholders reuse `lines.placeholderName`/`routes.placeholderName` and `lines.style.*`. Layer "Always draw" options have one message each. `px`, `X` and `Y` joined the lint `allowedStrings` (units and axes).
- **13b** (2026-10-08): new `maps` keys `markers.*` (Markers panel and icon filter), `markerPanel.*` (actions, section strip), `markerLinks.*`, `markerArticles.*`, `markerHover.more` (plural), `text.rotateHint`, `spike.*`; `common` gained `mentionedIn`, `backToTop` and `description.*`. The Markers panel filters and the marker's view chips now word stored categories and tags (`markerCategoryLabel`, `markerTagLabel`) and icons (`iconLabel`, `iconGroupLabel`); the panel's own English-only `iconLabel` is gone. Link target kinds are keys (`markerLinks.target.*`). Relationship chips in the Articles tab are keys (`markerArticles.role.*`): a chip writes its text in the active language, and it is user content after that. "New {template} “name”" reads "Novo artigo: {template} “name”" in pt-BR, to avoid gender agreement with the template. `DescriptionSection`'s thrown "Could not create the description." is internal (the UI shows its own message). `MapSpike`'s inline styled-jsx CSS has a lint exception.
- **13c** (2026-10-08): every remaining error reply in `api/assets`, `api/layers/**`, `api/lines/**`, `api/routes/**`, `api/texts/**`, `api/thumbnails`, `api/tiles`, `api/zone-regions` and `server/maps/folder-routes.ts` goes through `errorResponse` (new `errors` keys, `regionHasZones` is a plural; the layer and region 409 replies keep their counts as extra fields). Still English on purpose: shape errors (`folderPatch`'s "extraLayerIds must be…", the boards' "Cards must be a list.") and stored revision reasons. The worker's own `lastError` ("Asset record missing", now `WORKER_ASSET_MISSING` in `src/worker/messages.ts`) is worded by `workerError` in `MapViewer`; errors from the image library stay as written (technical detail). The app title is `common` `appTitle`. Two `.ts` helpers had English fallbacks (`article-folders.ts`, `use-map-layers.ts`), now `common` keys. `LOCALIZED_GLOBS` is now all of `src/components/**` and `src/app/**`, with no bare JSX text left. Batch 13 and the plan are done.
