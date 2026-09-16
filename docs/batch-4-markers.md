# Batch 4 — Markers

Date: 2026-09-16

## What was built

- **Icon registry** (`src/server/markers/icon-registry.ts`) — the 24 stable app-owned icon keys from the plan's palette, each mapped to a Lucide export name, grouped (Settlements/Structures/Nature/Adventure/Services/Magic). Saved data references the stable key, never the Lucide name, so a future Lucide rename can't corrupt stored markers. Also holds the 11 preset colors, normalized to opaque `#RRGGBB`.
- **Marker CRUD API**: `GET/POST /api/maps/[mapId]/markers`, `PATCH/DELETE /api/markers/[markerId]`, `POST /api/markers/[markerId]/restore`, `POST /api/markers/[markerId]/duplicate`. Position updates are rejected server-side with 409 if the marker is locked and the request isn't also unlocking it. Linked-map assignment is validated same-world, same pattern as map reparenting.
- **Rendering** (`src/components/MarkerLayer.tsx`) — fixed-screen-size OpenSeadragon overlays (per the plan's constant-size-icon rule), each a small React root (`MarkerIcon`: dark contrast backing + colored Lucide glyph) mounted imperatively and kept in sync with marker state. Positioned via `tiledImage.imageToViewportCoordinates(u * width, v * height)`, `placement: BOTTOM` so the icon's point anchors exactly to the stored coordinate.
- **Interactions**: click-to-place (Edit mode, canvas-click gated by `addingMarker`, `event.quick` check so a drag/pan never counts as placement); drag-to-move with a 5px threshold, map panning suppressed during the drag, Escape snaps back to the original position immediately; click-to-select works in both Browse and Edit mode (locked markers always just select, never drag); overlap chooser when multiple markers' anchor points are within 16px of each other.
- **Marker panel** (`src/components/MarkerPanel.tsx`) — rename, icon picker (grid of all 24), color picker (11 presets), linked-map select with an "Open linked map" action, lock/unlock, duplicate, copy-link (writes a `?marker=` deep link to the clipboard), delete.
- **Delete/undo** — soft delete + a 6-second toast with an Undo button that calls the restore endpoint.
- **Mode toggle** — Browse/Edit button in the viewer toolbar; "Add marker" only appears in Edit mode.

## Bugs found and fixed during this batch (all caught by testing, not assumed away)

1. **`setOsd(OSD)` crashed the viewer.** `OSD` (OpenSeadragon's factory function) was passed directly to a `useState` setter; React's setter treats a function argument as a lazy updater and *calls* it with the previous state, so it ran `OpenSeadragon(null)` instead of storing the function, crashing with `Cannot read properties of null (reading 'appendChild')`. Fixed with `setOsd(() => OSD)`. This is why the original spike/MapViewer code (which stored OSD in a plain ref, not state) never hit it — switching to state so `MarkerLayer` could react to it introduced the bug.
2. **Browse mode couldn't select markers at all.** The overlay's `mousedown` handler was gated entirely behind `mode === "edit"`, so clicking a marker in Browse mode (the normal "just looking" mode) did nothing. Fixed so Browse mode (and locked markers in Edit mode) always select on click; only unlocked markers in Edit mode also support drag.
3. **Stale closures on mode/marker toggles.** Each overlay's `mousedown` listener is attached once, when the overlay is first created — it was closing over `mode`/`markers` from that moment, so toggling Browse↔Edit after markers were already rendered wouldn't change their drag behavior. Fixed with a ref (`latestRef`) kept current via a small effect, read at event time instead of closed over at attach time.
4. **Overlap chooser almost never triggered, even for exact-coordinate overlaps.** It compared the raw click point to each marker's anchor (bottom-center, since `placement: BOTTOM`), but the user clicks the visible glyph, which renders *above* the anchor — a systematic ~17px offset that usually exceeded the 16px overlap radius. Verified with two markers at literally identical `u`/`v`: the chooser still didn't appear. Fixed by comparing marker-to-marker anchor distance instead of click-to-anchor distance (we already know which marker was clicked; the right question is "what else is near *it*," not "what's near my imprecise click").
5. **React console error on marker delete**: "Attempted to synchronously unmount a root while React was already rendering" — unmounting a nested `react-dom/client` root synchronously inside the effect that reacts to `markers` changing. Fixed by deferring `entry.root.unmount()` with `queueMicrotask`.

## Verified

| Check | Result |
| --- | --- |
| Place marker (Edit → Add marker → click image) | Created at the exact clicked image coordinate; name field auto-focused |
| Rename, icon, color | All persist via `PATCH`, visible immediately and after reload |
| Drag-to-move | Moves only the marker, map does not pan; position persists across reload |
| Escape during drag | Snaps back to original position immediately (didn't need to release the mouse first) |
| Select in Browse mode | Works (was broken, now fixed — see above) |
| Duplicate | Creates a copy offset by 0.02 u/v, selects it |
| Delete + Undo | Soft-deletes, shows toast, Undo restores (`deletedAt` back to null) — verified via direct DB inspection, not just visually |
| Lock | Locked marker in Edit mode selects instead of dragging; server rejects a position update on a locked marker without explicit unlock (409) |
| Overlap chooser | Two markers at identical `u`/`v` correctly list both by name; positioned next to the click, not the viewport corner |
| Linked map | "Open linked map" navigates to the target map |
| `npm run test` / `lint` / `build` | All clean |

## Notes / deviations from the plan doc

- Marker categories (the `marker_categories` table from Batch 1) aren't exposed in the UI yet — the plan lists this as optional, and icon/color already cover the "what kind of place is this" need for now.
- Descriptions are still plain — no rich-text body yet (Batch 5).
- No keyboard-accessible marker list / focus fan-out for dense overlaps beyond the click-based chooser — acceptable for the current marker counts; revisit if real usage produces very dense clusters.

## Ready for Batch 5

Rich descriptions: Tiptap schema and toolbar, reader panel, autosave, conflict handling, draft recovery.
