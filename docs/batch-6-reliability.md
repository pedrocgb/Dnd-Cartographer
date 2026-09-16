# Batch 6 — Reliability

Date: 2026-09-16

## What was built

- **Search** (`GET /api/search?q=`, `src/components/SearchBox.tsx`) — searches active (non-deleted) map and marker names in the workspace, debounced, shown as a dropdown in the nav bar; each result links straight to the map (or `/maps/:mapId?marker=:markerId` for a marker).
- **Local deep links** (`MapWorkspace.tsx`) — `/maps/:id?marker=:markerId` now actually does something: once the viewer and marker list are ready, it pans/zooms to center the marker and selects it, opening the detail panel. (The link itself — `?marker=` + copy-to-clipboard — already existed from Batch 4; this batch made it functional on the receiving end.)
- **Image replacement** (`MapViewer.tsx`) — the map detail panel now has an "Upload image" / "Replace image" control at all times (previously a map created without an image had no way to add one later). Replacing shows a confirmation explaining that existing marker positions are normalized and won't automatically re-align to different artwork/framing.
- **Export** (`GET /api/export`, `src/server/portability/build-export.ts`) — a single versioned JSON bundle: world name, map categories, marker categories, rich documents, maps (with hierarchy via `parentId`), markers (with `linkedMapId`), and each map's current original image embedded as base64. Downloads directly via `Content-Disposition`.
- **Import** (`POST /api/import`, `src/server/portability/import-export.ts`, `/import` page) — validates the bundle (version, required sections, size limits, and every embedded document against the same `validateDocument` used for live saves), then inserts everything with **fresh ids**, remapping every relationship (`parentId`, `categoryId`, `descriptionDocumentId`, `linkedMapId`) through per-entity id maps built during the same import. Embedded images are decoded, re-validated through the same `validateImageFile` the upload path uses, written into managed storage, and queued as new processing jobs so tiles regenerate normally.
- **Orphan cleanup** (`scripts/cleanup-orphans.mjs`, wired into `launch.mjs` startup) — removes any `tiles/`/`thumbnails/` directory whose asset id has no matching `map_assets` row (the only orphan case possible under this app's soft-delete model, e.g. from a job that half-completed before its DB row was written).
- **Backup / restore** (`scripts/backup.mjs`, `scripts/restore.mjs`, `npm run backup` / `npm run restore`) — backup uses SQLite's `VACUUM INTO` for a transactionally-consistent DB snapshot without stopping the app (safe against concurrent reads/writes, unlike copying the `.db` file directly), plus a recursive copy of `originals/`, `tiles/`, `thumbnails/` (skipping ephemeral `temp/`). Restore copies a backup into a fresh, empty data directory.

## Verified

| Check | Result |
| --- | --- |
| Search | `?q=batch` correctly matches map names; browser dropdown shows type + context ("on Batch 5 Test Map 2") |
| Deep link | `/maps/:id?marker=:id` opened the map, panned/zoomed to the marker, and auto-selected it |
| Image replacement UI | "Replace image" button present and reachable from the detail panel |
| **Export → Import round trip** | Exported the live workspace, re-imported it into the same world: map count doubled correctly, and a purpose-built parent/child pair with a cross-map `linkedMapId` marker confirmed every relationship was remapped to the **new** ids, not left pointing at the originals |
| Imported images | All 3 (then 6, cumulative) embedded images were queued and reached `state: "ready"` after the worker processed them — full re-tiling confirmed, not just DB rows |
| Imported descriptions | Rich-document content (`plain_text`) matched the original across every import generation, with independent document ids |
| Import validation | Runs every embedded document through the same schema validator as live saves — an import can't smuggle in a malformed document that live editing would reject |
| **Backup → Restore round trip** | Ran `backup.mjs` against the live (running) data directory, then `restore.mjs` into a fresh directory; queried the restored DB directly — map/marker counts matched the live database exactly, and a sampled asset's original image + generated tiles were confirmed present on disk at the expected paths |
| Orphan cleanup | Injected a fake orphaned tile directory (random id, no matching `map_assets` row) — `cleanup-orphans.mjs` removed exactly that directory and nothing else |
| `npm run test` (17) / `lint` / `build` | All clean |

## Notes / deviations from the plan doc

- **Import merges into the existing world instead of creating an isolated new one.** The plan's wording says import "creates a new world rather than merging" — but this app has no world-switcher UI anywhere; every route resolves the active world via `ensureDefaultWorld()`. Importing into a genuinely separate world would make the imported data invisible with no way to reach it. Merging additively (fresh ids for everything, so nothing can collide with or overwrite existing data) delivers the plan's actual safety goal — an import can never corrupt what's already there — in a form that's actually usable today. Revisit if/when multi-world switching is built.
- Export embeds images as base64 inside one JSON file rather than a real zip archive. Simpler (no new archive-library dependency, single-file download/upload), and inflation (~33%) is a non-issue at this app's confirmed personal scale; revisit if source images grow enough to make that overhead matter.
- Export includes only each map's **current** asset generation, not full asset history — consistent with the plan ("tiles can be regenerated") and keeps bundle size down.
- Backup only covers `world-wiki.db`, `originals/`, `tiles/`, `thumbnails/` — not `temp/` (ephemeral upload staging) or `exports/` (derived, regenerable output).

## Ready for Batch 7

Release readiness: browser checks, the performance benchmarks from the roadmap, offline use, local startup/shutdown documentation.
