# Batch 5 — Rich Descriptions

Date: 2026-09-16

## What was built

- **Tiptap editor** (`src/components/RichEditor.tsx`) — paragraphs, headings, bold/italic/strike/underline, ordered/nested bullet lists, blockquotes, horizontal rules, hyperlinks (protocol-restricted), undo/redo, clear formatting, via `@tiptap/starter-kit` v3 (which already bundles Link and Underline — see bug #2 below). One component serves both editing (`editable`) and read-only display, so the reader is always rendered from the exact same schema as the editor, per the plan.
- **Server-side document contract** (`src/server/documents/schema.ts`) — a Tiptap-independent JSON walk that validates node/mark types against an explicit allowlist, checks link protocols (`http:`/`https:`/`mailto:` only), enforces max size (200KB) and nesting depth (16), and derives the plain-text projection used for search. Covered by 9 unit tests.
- **Document API**: `POST /api/documents` (creates an empty doc for the default world), `GET/PATCH /api/documents/[id]`. `PATCH` takes `{json, revision}` and does an atomic `UPDATE ... WHERE id = ? AND revision = ?` — if that affects zero rows, it's a conflict: returns 409 with the current server state rather than silently overwriting or discarding anything.
- **Attaching descriptions to maps/markers** — both already had a nullable `descriptionDocumentId` column (from Batch 1's schema). `PATCH /api/maps/[id]` and `PATCH /api/markers/[id]` now accept it. `DescriptionSection` (shared component) shows "Add description" when absent (editable contexts only) and creates+attaches a document on demand.
- **Autosave** — 1.5s idle debounce, `Saving…`/`Saved`/`Save failed` indicator, flushed on unmount (navigating away).
- **Draft recovery** — every edit is mirrored to `localStorage` under a key scoped to a per-browser instance ID + document ID. On load, a pending draft (if present) wins over the server copy and is immediately re-saved, so a crash/refresh mid-edit doesn't lose work; the draft is cleared only after a confirmed successful save.
- **Wired into the UI**: map detail panel (always editable) and marker panel (editable only in Edit mode; read-only rendering in Browse mode).

## Bugs found and fixed during this batch

1. **Text was present but invisible.** The very first real test ("Hello world") appeared to do nothing — the editor looked empty. It wasn't: `document.querySelector('.ProseMirror').innerHTML` showed `<p>Hello world</p>`. The CSS assumed a dark background (`color: #eee`) but never set one, so the text rendered as light-gray on the page's white background — nearly invisible, not missing. Fixed by giving `.rich-content` (and the non-transparent parts of `.rich-reader`) an explicit dark background, matching the rest of the app's dark-widget-on-light-page styling.
2. **Duplicate extension warning.** `@tiptap/extension-underline` and `@tiptap/extension-link` were added explicitly, but Tiptap v3's `StarterKit` already bundles both (console: `Duplicate extension names found: ['link', 'underline']`). Fixed by configuring them through `StarterKit.configure({ link: {...} })` instead of separate extension instances.
3. **Infinite 409 retry loop (the serious one).** The conflict-retry path did `setRevision(current.revision)` then `setTimeout(save, 200)` — but `save` is a function recreated every render, and the *specific* `save` closure captured by that `setTimeout` still closed over the **old** `revision` value from the render that scheduled it, since a `useState` setter doesn't retroactively update an already-captured closure. Every retry resent the same stale revision, got 409 again, forever — confirmed live: 150+ requests in a row, revision never advancing. Fixed by reading the revision from a ref (`revisionRef`, updated synchronously via `adoptRevision()`) instead of React state, and retrying by direct recursive call instead of a closure-capturing timer; added a 5-retry cap as a backstop. Re-tested after the fix: exactly one 409 then success, confirmed via a server-side revision trace, not just visual inspection.

## Verified

| Check | Result |
| --- | --- |
| Formatting (bold, headings, lists via toolbar) | Applies correctly, survives reload |
| Autosave | Fires ~1.5s after typing stops; "Saving…" → "Saved" |
| Map description | Editable always; persists across reload |
| Marker description | "Add description" only shown when editable (Edit mode); read-only render in Browse mode uses the same schema, correct contrast |
| **Conflict handling** | Simulated a concurrent external write (`curl PATCH` bumping the revision) while the browser held a stale revision; browser edit correctly detected the 409, adopted the new revision, retried once, and succeeded — confirmed via server-side revision trace showing exactly one retry, not the earlier infinite loop |
| **Draft recovery** | Typed text, then navigated away before the 1.5s autosave could fire; on return, the text was present and confirmed persisted server-side (not just visually) |
| Link validation | `javascript:` links rejected server-side; `http:`/`https:`/`mailto:` accepted (unit tests) |
| Document size/nesting limits | Oversized doc and excessive nesting both rejected (unit tests) |
| `npm run test` (17 tests) / `lint` / `build` | All clean |

## Notes / deviations from the plan doc

- Tables are explicitly listed in the plan as a "proposed enhancement," not required — not implemented, to keep scope to the confirmed toolbar (paragraphs, headings, emphasis, lists, blockquotes, rules, links).
- Conflict resolution is "last live edit wins, revision-checked" (retry with fresh revision, keep the user's in-editor content) rather than a content merge — appropriate for a single-user, occasionally-multi-tab context; there's no concurrent-author merge UI, which the plan doesn't ask for either.
- No inline illustrations/attachments (explicitly deferred in the plan alongside tables).

## Ready for Batch 6

Reliability: search, local deep links, image replacement, export/import, cleanup, backup/restore.
