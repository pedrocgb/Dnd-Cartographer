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
- **Namespaces:** `common` (shared words and app-wide), `nav`, `settings`, `maps`, `politics`, `editor`, `articles`, `calendars`, `campaign`, `tools`, `errors` (server and API messages). Add new ones only when an area clearly needs its own.
- **Whole sentences only:** never build a sentence from pieces. Use `t("deletedOn", { date })`, not `"Deleted " + date`. Word order differs in pt-BR.
- **Visible text includes** JSX text, `placeholder`, `aria-label`, `alt`, `data-tooltip`, `label`/`title`/`description` props, `confirm()`/`alert()`, and error strings that reach the UI.
- **Server errors:** move them to `errors.json` and return `t(...)` from `serverT("errors")`. Components already show `data.error` as received.
- **Numbers inside messages:** format them first with the existing helpers (`formatDecimal`, `formatInteger`) and pass the result as a param. For plurals, pass the raw number as `count` and the formatted one as `n`: `t("stats.maps", { count, n: formatInteger(count) })` with `"{n} maps"`.
- **Markup inside a sentence** (bold name, link): keep the whole sentence in one message with a placeholder, then split it in the component: `const [before, after] = t("typeToConfirm").split("{text}")`, render `{before}<strong>…</strong>{after}`. `t()` without params leaves `{text}` in place.
- **Catalog arrays** (menus, segments, tool lists): give items a `labelKey`/`id` and translate when rendering; an English `label` may stay as the fallback.
- **Server validators** that return messages (e.g. `parseWorldFields`, `sanitizeSettingsPatch`) return an `errors` key (plus params); the route translates it with `serverT`. Thrown validation errors carry `key`/`params` (see `ImportValidationError`).
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
| Hierarchy types "Empire, Kingdom…" (`hierarchy-config.ts`) | Stored keys that `allowedParentTypes` refers to. Translate built-in types on display; show custom types as typed. |
| Article info select options (`server/articles/info-sets/*`) | The English value is the stored key. The display label comes from the dictionary keyed by that value. |
| Weather days (`calendar_weather.data`, plus localStorage history) | New days store codes and render labels at display time. Days saved before that keep their English text and are shown as-is. |
| Generated defaults ("Layer n", "Zone n", "(copy)", "New marker", "New text"), character-on-demand article | Written in the active locale when created. After that they are user content. |
| Share pages | Use the owner's language (the app setting). |

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

## Batches

Large batches (3, 4, 8, 10) can be split into sub-batches of about 8–12 files. Record the split here.

- [x] **0. Foundation:** `src/i18n/*`, `<html lang>`, metadata, `SettingsProvider` save error, `GeneralSettings`, month names in `date-format.ts`, `LOCALIZED_GLOBS`, `tests/i18n.test.ts`.
- [x] **1. Shell and shared primitives:** `AppNav`, `Modal`, `ConfirmDialog`, `Skeleton`, `LoadingScreen`, `SearchBox`, `DatePicker`, `IconPicker`, `Toggle`, `ToolSection`, `components/worlds/*`, `app/worlds/page.tsx` (metadata), `src/proxy.ts` messages.
- [x] **2. Settings, trash, import/export:** the rest of `components/settings/*` (`TrashView`, `FormatSettings`, `SettingsNav`, `parts`), `server/trash/list.ts` fallbacks, `components/shortcuts.ts`, `settings.ts` `sanitizeSettingsPatch` errors, `api/settings`, `import-export.ts` errors, `api/export`, `api/import`.
- [ ] **3. Maps A, workspace:** `MapWorkspace`, `MapViewer` (alerts, "Processing failed"), `LayerFolders`, `components/maps/*`, `seed-categories.ts`, default "Layer n"/"Zone n"/"New marker"/"New text", `api/maps/**` errors.
- [ ] **4. Maps B, panels and HUD:** `ZonesPanel`, `TextPanel`, `LinePanel`, `map-hud/*`, `marker-panel/*`, `server/markers/icon-registry.ts`, `travel.ts` `formatDuration`, `scale/area.ts`, `units.ts` labels, `api/markers`, `api/zones`.
- [ ] **5. Politics:** politics components, `PoliticalReferencesPanel`, `hierarchy-config.ts` display labels, `politics/seed.ts`, `relations/validate.ts`, `api/politics/**`.
- [ ] **6. Rich editor:** `components/rich-editor/*`, `RichEditor.tsx`, placeholders passed by its callers, `documents/schema.ts` errors.
- [ ] **7. Articles A, UI:** `components/articles/*` (`InfoBar`, `templates.ts` `TEMPLATE_LABELS`), `api/articles`, share page (`app/share/[token]`, `server/share/load.ts`, `components/share/*`).
- [ ] **8. Articles B, info-sets:** `server/articles/info-sets/*` (27 files: field labels, hints, option display map), `info-fields.ts`.
- [ ] **9. Calendars:** `components/calendars/*`, `calendars/parse.ts`, `engine.ts`, `celestial.ts` (phases seeded in the active locale), `impact.ts`, `respond.ts`, `api/calendars/**` including "(copy)".
- [ ] **10. Campaign:** `quests/*`, `sessions/*`, `writer/*`, `relations/*`, `campaign/*`, the `types.ts` label maps, `writer/templates.ts`, the `parse.ts` errors, `api/campaigns`, `quests`, `sessions`, `writer`.
- [ ] **11. Tools, weather:** `src/lib/weather/*` (codes instead of English text, labels at render time, legacy days shown as-is), `DayWeather`, `WeatherGenerator`, `WeatherModal`, `server/calendars/weather.ts`.
- [ ] **12. Tools, character on demand:** `lib/character-on-demand/*` (`GENDERS`/`BACKGROUNDS` keys, pt-BR backstory grammar with gender agreement), `server/character-on-demand/document.ts`, `api/tools/character-on-demand/**`, tools UI, `RecentList`.
- [ ] **13. Sweep:** remaining root `src/components/*.tsx`, `spike`, worker `lastError` mapping. Widen `LOCALIZED_GLOBS` to all of `src/components/**` and `src/app/**`.

## Batch log

- **0** (2026-10-08): foundation in place. Only `common` and `settings` (General card) are translated. Month names in `formatRealDate` follow the language.
- **1** (2026-10-08): done in one pass (15 small files). New namespaces `nav`, `tools`, `worlds`, `errors`. Also covered: `WorldDateLabel`, `tools/tools.ts` labels (now with `id`), `api/worlds/**`, `server/world/worlds.ts` validator, `guards.ts` `foreignIdResponse` (now async; its 9 callers already `return` it). `Skeleton.tsx` became `"use client"` because it now uses `useT`. `DatePicker` month, weekday and day names come from `Intl` (weekdays now 3 letters, e.g. "Sun"/"dom."). Left in English on purpose: `src/proxy.ts` messages (403s only reach non-local or cross-origin requests; the 409 `noWorld` reply makes the client redirect without showing its text) and the brand "World Wiki" (allowed in the lint rule).
- **2** (2026-10-08): done in one pass (about 17 files, most small). New namespaces `trash`, `shortcuts`; more `settings` and `errors` keys. `shortcuts.ts` is now a catalog of message keys, worded by `localizeShortcutGroups(groups, t)`; mouse key caps (Click, Drag, Wheel…) are translated, keyboard keys are not. `SETTINGS_SECTIONS` items have an `id` instead of English labels. `sanitizeSettingsPatch` returns `{ error: "invalidSettingValue", setting }` (tests updated). Trash purge skip reasons are structured (`SkipReason`) and worded by `describePurgeResult`. Left for later: article template subtypes in the Trash list ("Character", from `TEMPLATE_LABELS`, batch 7); the sample in-world date "12 Alder 1024 AR" in Formats stays as made-up names.
