# Batch 3 — Map Management

Date: 2026-09-16

## What was built

- **Seeded categories** (`src/server/maps/seed-categories.ts`) — the 16 categories from the plan's map-organization table (Cosmology/Planes through Custom), seeded once per world on first request to `GET /api/map-categories`; `POST` adds custom ones.
- **Hierarchy queries** (`src/server/maps/tree.ts`) — `listMapSummaries()` (category label, thumbnail, asset state, live child count, all computed in-memory) and `getBreadcrumbs()` (ancestry chain, defensively cycle-safe for the UI even though cycles can't be created going forward).
- **Map CRUD API**:
  - `GET /api/maps` (`?trash=true` includes soft-deleted) / `POST /api/maps` (name, optional category, optional parent — parent existence + same-world checked at creation too, not just on reparent).
  - `GET /api/maps/[mapId]` — map, category, breadcrumbs, children, plus the asset/job status from Batch 2.
  - `PATCH /api/maps/[mapId]` — rename, change category, reparent (routes through Batch 1's `reparentMap()`/`validateReparent()` transaction, so cycle/self-parent/cross-world protection applies here for free).
  - `DELETE /api/maps/[mapId]` — soft delete; 409 with `childCount`/`childIds` if it has live children and no `strategy` was given; `{strategy: "cascade"}` soft-deletes the whole subtree level-by-level, `{strategy: "orphan"}` promotes children to root first.
  - `POST /api/maps/[mapId]/restore` — clears `deletedAt`; if the original parent is gone or still deleted, restores as a root instead of leaving it hanging off a dead reference.
- **Thumbnail serving** (`GET /api/thumbnails/[assetId]`) — same validated-ID pattern as tile serving, separate from the tile route since thumbnails live in their own storage category.
- **UI**: persistent nav (Maps / Create map / Trash) in the root layout; `/maps` — searchable tree view with thumbnails, category + child-count + processing-state pills; `/maps/[mapId]` — breadcrumbs, inline rename/category/parent editors, children panel, delete button (prompts for cascade-vs-orphan when the map has children), viewer below; `/maps/trash` — list with Restore; `/maps/new` — extended with category and parent selects, image now optional at creation time.

## Verified

| Check | Result |
| --- | --- |
| Category seeding | `GET /api/map-categories` returns all 16 seeded labels on first call |
| Create root + child map | Child correctly gets `parentId`; parent/world validated at creation |
| Breadcrumbs | Root map: `["Continent Root"]`; child: `["Continent Root", "City Child"]` |
| Children panel | Root's `children[]` correctly lists its direct child |
| **Cycle protection via API** | `PATCH` trying to make a root the child of its own child → 400 `"This move would create a cycle."` |
| Delete with children, no strategy | 409 with `childCount: 1` and the child's id |
| Delete with `strategy: "cascade"` | Both parent and child soft-deleted; appear in `?trash=true` |
| Restore a child whose parent is still deleted | Restored as a root (`parentId: null`) rather than left dangling |
| Browser: manager tree | Thumbnails render for maps with a ready image, empty-state box otherwise; search filters by name |
| Browser: detail page | Breadcrumbs, rename/category/parent editors, and the OpenSeadragon viewer all render together |
| `npm run build` / `lint` / `test` | All clean |

## Bug found and fixed during this batch

The viewer initially rendered with **zero height** on `/maps/[mapId]` once wrapped inside the new persistent nav layout: `.spike-viewer { height: 100% }` was resolving against a parent (`.spike-root`) whose height came only from `min-height` — CSS percentage heights don't resolve against `min-height`, only an explicit `height` (or a flex-stretched size). Fixed by making the nav layout's main area and the map page's wrapper proper flex columns (`.app-main`, `.map-page-root`) so `.spike-root` gets `flex: 1 1 auto` instead of a percentage height. Verified visually on both `/maps/[mapId]` and `/spike` afterward.

## Notes / deviations from the plan doc

- Reparenting UI is a plain `<select>` of every other map, not drag-and-drop in the tree — sufficient for a personal, moderate-map-count workspace; revisit only if the map count grows large enough to make a flat dropdown unwieldy.
- Map descriptions (rich text) are still out of scope — that's Batch 5. The "optional description" field from the plan's map-creation list isn't in `/maps/new` yet for that reason.
- Child-count and category joins are computed in memory across all of a world's maps rather than via SQL aggregates — fine at personal-worldbuilding scale.

## Ready for Batch 4

Markers: placement, fixed-size icon/color overlays (the rendering approach already validated in the Batch 0 spike), hover/selection, move, duplicate, delete/undo, overlap chooser, linked maps.
