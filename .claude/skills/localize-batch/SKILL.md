---
name: localize-batch
description: Localize one batch of the World Wiki app (en-US + pt-BR) following docs/localization.md. Use when asked to localize, translate or i18n a batch, screen or area of the app, or to "continue the localization".
---

# Localize one batch

The plan, conventions, glossary and progress all live in `docs/localization.md`. Read it first; it overrides anything here. Do **one** batch (or one recorded sub-batch) per run, then stop.

## Limits
- At most 2 subagents per batch, always with `model: "sonnet"` or lower. Never use opus or higher. Inline work is the default.
- Don't start the next batch unless asked.
- This is Next.js 16: read `node_modules/next/dist/docs/` before touching routing, metadata or proxy APIs.

## Steps
1. **Pick the batch.** Use the one named, otherwise the first unchecked one in `docs/localization.md`. If it has more than about 12 files, propose a sub-batch split, record it in the doc, and do the first part.
2. **Inventory strings** with Grep over the batch files:
   - JSX text: `>[^<{}]*[A-Za-z][^<{}]*<`
   - Props: `(placeholder|aria-label|alt|data-tooltip|label|title|description)="`
   - Dialogs: `confirm\(|alert\(`
   - Server: `error: "|throw new \w*Error\("|fail\("`
   - Data catalogs: `label: "|hint: "|description: "`

   Skip CSS classes, keys, ids, URLs, and anything that is user content.
3. **Add keys** to `src/i18n/messages/en-US/<ns>.json`, then natural pt-BR to `pt-BR/<ns>.json`, using the doc's glossary (extend it when you settle a new term). A new namespace also needs its imports in `src/i18n/messages/index.ts`. Write whole sentences with `{params}` and `_one`/`_other` plurals.
4. **Replace literals:**
   - client components: `const t = useT("ns")`
   - server components, routes, `src/server/**`: `const t = await serverT("ns")`
   - client helpers outside components: `activeT("ns")`
   - stored English values: follow the doc's rules table, and never change what is stored for existing rows.
5. **Lint guard:** add the batch's files or folders to `LOCALIZED_GLOBS` in `eslint.config.mjs` under a `// Batch N` comment.
6. **Verify.** All of these must pass:
   - `npx tsc --noEmit` (if route types are stale, run `npx next typegen` first)
   - `npx eslint <batch files>`
   - `npx vitest run --exclude ".claude/**"` (if this batch adds the first plural or param messages, add a translator test for them)
   - Run the app (`npm run launch:dev`), switch Settings › General to Português, walk through every screen in the batch and look for leftover English or broken layout from longer pt-BR text. Switch back afterwards if the user was on English.
7. **Close out:** tick the batch in `docs/localization.md` and add a line to the batch log (date, sub-batch, deviations). Report the changed files and anything left in English on purpose. Commit only when the user asks: `feat(i18n): localize <batch>`, with no AI trailer.
