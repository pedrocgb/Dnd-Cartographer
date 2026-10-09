# Settlement Generator: plan and progress

A new Advanced Tool (`/tools/settlement-generator`) that rolls a whole medieval-fantasy settlement from a mood the user picks. The work is split into 6 steps; the user hands them over a few at a time. This file is the hand-off for whoever continues: read it first.

## Status (2026-10-09)

| Step | What | State |
|---|---|---|
| 1 | Inputs: type, geography, climate, prosperity, tone (Random by default) | Done |
| 2 | Name, population, purposes, origins and current condition, summary paragraph | Done |
| 3 | Physical layout and infrastructure | Rolls done (`layout.ts`); **text and UI next** (phase 3 below) |
| 4 | Establishments (optional) | Planned (phases 4–6 below) |
| 5–6 | Not handed over yet (step 6 includes creating wiki articles) | — |

Commits so far: `b6ffcbe`, `fa18156`, `c65d578` (steps 1–2), `bcc5f5a` (rule engine), `0a94c22` (layout rolls). Work goes straight to `master`, one commit per concern, English Conventional Commits, no AI trailer.

## How the code is laid out

- **Rolls:** `src/lib/settlement-generator/`.
  - `options.ts` holds the input lists and the rolled value lists (all English keys).
  - `inputs.ts` resolves the inputs. Picked options are kept; random ones are weighted by what is already known.
  - `purposes.ts` rolls the purposes.
  - `origins.ts` rolls the founding, age, growth, condition and recent change.
  - `population.ts` rolls the population on a log scale inside the type's band.
  - `layout.ts` rolls step 3.
- **`rules.ts` (shared rule engine):**
  - `Rule { key, weight?, requires?, by: { <context field>: { value: factor } } }`.
  - Functions: `ruleWeight`, `rollRule`, `rollRules` (without replacement), `ruleAllowed`.
  - `SettlementContext` is everything rolled so far, flattened (inputs + `primary`, `purposes[]` + origins), and `contextOf(inputs, purposes, origins)` builds it.
  - Use these rules for every new table.
- **`generate.ts`:** `generateSettlement(resolved, namePool, rng, locale?, avoid?)`. The UI calls `resolveInputs` first, then `loadNamePool(type)`.
- **Text:**
  - Values are stored in English and worded on display through `labels.ts` (`settlementLabel(group, value)`), using the `settlement` namespace (`src/i18n/messages/<locale>/settlement.json`).
  - The summary is written once in the active language from `narrative/<locale>.ts`. Tables are named `<group>_<Value>` (`slotKey`), and pt-BR words agree with the settlement noun via `{masc|fem}` (`masculineTypes`).
- **Names:** come from `docs/settlements-names-list/*.md`. `npm run settlement-names:build` turns them into `names/<type>.json` (lazy-loaded per type), and `pickName` avoids recent names.
- **UI:**
  - `src/app/tools/settlement-generator/page.tsx`.
  - `src/components/tools/SettlementGenerator.tsx` holds the options card, Generate, result panel and recent list.
  - `SettlementResult.tsx` renders the result, one section per step.
  - History lives in localStorage (`useToolHistory`, `lib/settlement-generator/history.ts`).
- **Tests:** `tests/settlement-generator.test.ts` runs statistical coherence checks with a seeded rng, checks every value has a label and phrase in every locale, and checks parity.

Localization rules: the `localize-new-ui` skill and `docs/localization.md` (batch 14). Every new text goes in en-US **and** pt-BR in the same change.

## Decisions made with the user

- Results appear in a full-width result panel (not a modal).
- No wiki article until step 6.
- Geography is a curated list of 18.
- Step 3 is shown as text sections, with no drawn map.
- **Step 4 establishment set:**
  - The mode (Essential or Full) decides the base set from population and purposes.
  - The user can add extra slots on top.
- **Step 4 owners:**
  - Default is a random Character On Demand roll per establishment.
  - After generating, each establishment can switch its owner to an existing character.
- **Step 4 opening hours:** one optional calendar for the whole settlement. No calendar means no hours in the result.
- **Establishment names:** the user will upload a list organized **by establishment type** (not received yet).

## Next phases

### Phase 3: step 3 text and UI
1. **Text:**
   - Add `layout/en-US.ts` and `layout/pt-BR.ts`: phrase tables with 1–2 short variants per value, named `<fact>_<Value>` with `slotKey`. Facts: `center`, `roadKind`, `waterSource`, `waterSupply`, `foodStore`, `workshops`, `market`, `burial`, `outlying`, `limit`, `streets`, `density`, `materials`, `sanitation`, `lighting`, `bridges`, `docks`.
   - The pt-BR text agrees with the settlement noun where needed. The rolled texts are written in the active language and stored (like `summary`).
2. **Labels:** add them in `settlement.json` (both locales) as `layout.<fact>.<Value>` and `direction.<Direction>`, plus the UI strings: section title "Layout and infrastructure" and one fact label per item.
3. **Result shape:**
   - `generate.ts` rolls `rollLayout(contextOf(...), rng)` and stores `layout` plus its texts.
   - `GeneratedSettlement.version` becomes `2`.
   - `history.ts` keeps accepting `version: 1` entries; the UI skips sections they don't have.
4. **Section component:** `SettlementLayout.tsx`, shown in `SettlementResult.tsx` with a facts grid and the short texts. Roads read as "{direction}: {kind}". Bridges and docks are left out when `null`.
5. **Tests:**
   - Every value of every `LAYOUT_OPTIONS` table (plus `DIRECTIONS`) has a label in every locale and a phrase table.
   - The tables expand with no `{}|` left, and the locales have the same tables and entry counts.
6. **Docs:** add a batch log row in `docs/localization.md`.

### Phase 4: step 4 logic (`settlement-generator/establishments/`)
- **Catalog (`catalog.ts`):** about 45 types, each:

  ```ts
  { key, category, tier: "essential" | "common" | "specialist", minType, support, by, requires }
  ```

  - Categories: Food and drink, Lodging, Crafts, Trade, Faith, Services, Security, Maritime, Arcane, Vice.
  - Seed list: `BUILDING_TYPES` in `src/server/articles/info-sets/building.ts`.
  - It must include Mill, Ferry, Shrine, Blacksmith, Permanent Inn, Traveler's Rest, Magic Shop, Professional Guardhouse and Watch Post. Ferry and Shipwright need water, among other requirements.
- **Selection (`select.ts`):**
  - Essential mode uses essential-tier types only. Full mode uses every tier, with the count from population / `support`, scaled by purposes and tone.
  - Scarcity (Plentiful / Normal / Scarce / Very Scarce) cuts specialists and lowers availability.
  - Must-include and must-exclude are honored. An excluded Permanent Inn falls back to Traveler's Rest.
  - Caps: 8 in Essential, 30 in Full.
  - Extra slots `{ type | random, owner }` are appended.
- **Quality, price and availability:** keys from prosperity, scarcity, condition and recent change. For example, a Failed Harvest limits bakeries.
- **Opening pattern** (only with a calendar):
  - The pattern is Daily, Market Days, Seasonal or By Arrangement, weighted by type and size.
  - It uses the calendar definition's `weekdays[]`, `periods[]` (`kind: "month"` for seasonal runs, `kind: "special"` for "closed during {festival}").
  - Stored as `{ pattern, weekdays, months, closedOn }` and worded on display.
  - The calendars come from `loadWorldCalendars()` (`src/components/calendars/profile-lookup.ts`); skip the `trashed` ones.
- **Tests:** include/exclude are honored, essential mode fits the size, there is no ferry without water, and the hours only use the given calendar's names.

### Phase 5: step 4 text, names and owners
- **Text:**
  - Per-category grammar tables in en-US and pt-BR for the exterior/interior description, goods (3–5 picks per type), distinguishing detail, and the optional problem or secret (its chance comes from tone).
  - Per-type overrides use the Character On Demand `tablesFor` merge pattern. The materials text comes from the step 3 layout so the two agree.
- **Names:** from the user's per-type list (pending). Extend the name build script to write `names/establishments/<type>.json`, lazy-loaded per type, with a fallback grammar of "The {Adjective} {Noun}".
- **Owners:** `resolveSpecies` + `loadNames` + `generateCharacter` from `src/lib/character-on-demand/`, all client-side. The background follows the type: Blacksmith gets Artisan, Temple gets Acolyte, Trading Post gets Merchant.

### Phase 6: step 4 UI
- **Options card:** "Establishments", with:
  - a toggle (off by default)
  - mode and scarcity
  - must-include and must-exclude chips
  - a calendar picker (`InfoPicker`)
  - "Add establishment" rows
- **Result:** establishment cards grouped by category, each showing the owner with "Use an existing character" (`InfoPicker` over `GET /api/politics/people`, `kind === "npc"`), hours, goods, quality, price and availability, the description, the detail, and a collapsed secret.
- **Owner override:** saved into the history entry with `useToolHistory().save`.

## Verification after each phase
- `npx vitest run --exclude ".claude/**"`
- `npx tsc --noEmit`
- `npx eslint <changed files>`, plus a grep for literal props
- `curl` `/tools/settlement-generator` on the dev server (:3000). The browser is used only when the user asks.
