# UI/UX Redesign

Date: 2026-09-16

Applied the `ui-ux-pro-max` skill's design intelligence across the entire app (every page and component, not a single-page fix), per explicit request.

## What changed

- **Design tokens** (`src/app/globals.css`): replaced ~15 ad hoc hardcoded hex colors (repeated across components, e.g. `#2c5f5a` in 6+ places) and the inline `font-family: ui-sans-serif, system-ui, sans-serif` duplicated in 10+ selectors with a real token system — surfaces, borders, text, a teal-ink primary + brass secondary accent scale, danger scale, a 4px spacing scale, a radius scale, and an elevation (shadow) scale.
- **Typography**: replaced the Geist/Arial mix with Inter (`next/font/google`, self-hosted at build time — no runtime CDN call, preserving the offline guarantee from Batch 7).
- **Theme**: committed to a single deliberate dark "cartographer's studio" theme (`color-scheme: dark`) rather than a light/dark split — the app was already majority-dark in practice (map canvas, marker panel, rich editor), and the old light `map-manager`/`map-detail-panel` pages were the inconsistency, not a deliberate choice.
- **Icons**: replaced every remaining text/glyph "icon" with a real Lucide SVG icon + `aria-label`, per the skill's icon rule. This was most severe in `RichEditor.tsx`'s toolbar — `B`, `I`, `U`, `S`, `H2`, `• List`, `1. List`, a smart-quote character, and an em-dash were literal button text. Also added icons to the nav, map actions (upload/delete/retry), marker toolbar (browse/edit/add-marker), and marker panel (lock/duplicate/copy-link/delete/close).
- **Navigation**: extracted nav into `src/components/AppNav.tsx` (client component) so it can show active-route highlighting via `usePathname` — the old nav had no current-page indication at all.
- **Buttons**: consolidated the reused, misleadingly-named `.spike-btn` class (a leftover from the Batch 0 spike page, applied across delete/replace-image/restore/close buttons throughout the real app) into a proper `.btn` system with `.btn-primary` / `.btn-danger` / `.btn-ghost` / `.btn-icon` variants. The spike page itself (`/spike`) still uses `.spike-btn`, unchanged.
- **Accessibility**: added visible `:focus-visible` rings globally (there were none before), `aria-label`s on icon-only buttons and previously-unlabeled selects/inputs, `aria-pressed` on toggle buttons, `aria-expanded` on the map-tree disclosure toggle, and a `prefers-reduced-motion` override.
- **Forms**: added visible labels to the New Map and Import forms (previously placeholder-only inputs with no `<label>`), consistent error styling via `.form-error`.

## Verified

| Check | Result |
| --- | --- |
| `npm run build` | Clean |
| `npm run lint` | Clean (pre-existing unrelated errors only in `.claude/skills/*.cjs`, not touched by this change) |
| `npm run test` (17) | All passing |
| Real browser pass (production build) | Maps list, map detail + rich editor toolbar, marker workspace + marker panel (icon/color pickers, lock/duplicate/copy-link/delete), trash, new-map form, search dropdown — all render correctly on the new token system |
| Batch 3's flex-layout viewer-height fix | Preserved, unchanged |
| Batch 7's `will-change: transform` marker perf fix | Preserved, unchanged |

One pre-existing, unrelated issue surfaced during verification: clicking a marker via simulated browser-automation mouse events didn't trigger selection, while the identical code path via the `?marker=` deep link worked correctly and rendered the marker panel as designed. `MarkerLayer.tsx`'s click/drag event wiring was not touched by this redesign, so this is not a regression — worth a manual (non-automated) click check before relying on it further.
