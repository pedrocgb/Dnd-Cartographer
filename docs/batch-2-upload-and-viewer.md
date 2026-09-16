# Batch 2 — Upload & Viewer

Date: 2026-09-16

## What was built

- **Validation** (`src/server/assets/validate.ts`) — checks byte size, readable format (PNG/JPEG/WebP only, animated rejected), dimensions, and total pixel count against explicit limits (300 MiB, 20,000px per side, 120M pixels — headroom above the confirmed 7,680×4,320 / ~33.2M benchmark).
- **Streaming upload** (`src/server/assets/create-upload.ts`, `POST /api/maps/[mapId]/assets`) — pipes the request body straight to a temp file on disk (never buffered in memory), validates it, moves it into managed storage under a generation-versioned key, then records the `map_assets` + `processing_jobs` rows.
- **Worker** (`src/worker/index.ts`, run via `npm run worker` or as part of `npm run launch`) — polls `processing_jobs` for queued work or jobs whose lease expired (crash recovery), claims one job at a time, normalizes EXIF orientation, generates a lossless WebP DZI tile pyramid and a thumbnail via sharp, then marks the asset ready and updates `maps.currentAssetId`. Failed jobs retry up to 3 attempts before the asset is marked `failed`.
- **Retry** (`POST /api/assets/[assetId]/retry`) — re-queues a failed asset explicitly.
- **Tile serving** (`GET /api/tiles/[assetId]/[...path]`) — serves the `.dzi` manifest and tile files through the loopback app using the asset's DB-recorded generation, not a client-supplied path; rejects `..` segments; sets long-lived immutable cache headers (safe since each generation's output is never overwritten).
- **Status polling + viewer** (`src/components/MapViewer.tsx`, `/maps/[mapId]`) — polls map/asset/job state every ~1.2s while uploading/queued/processing, shows the error + a Retry button on failure, and mounts the OpenSeadragon viewer once `ready`.
- **Create-map UI** (`/maps/new`) — minimal form (name + file) wired to the two APIs above; not the real map-management UI (that's Batch 3), just enough to drive this batch's flow end-to-end.
- Launcher (`scripts/launch.mjs`) now also starts the worker process alongside the Next.js server, and clears `data/temp` on startup (uploads aren't resumable yet, so anything orphaned there is safe to discard).

## Verified

| Check | Result |
| --- | --- |
| Upload the Batch 0 sample (7,680×4,320, ~1MB PNG) via `curl` | 202, streamed without buffering, asset+job created |
| End-to-end processing | queued → processing → ready in ~1.5–2s; `manifestKey`/`thumbnailKey` populated, `maps.currentAssetId` updated |
| Tile serving | `.dzi` returns `application/xml` with `Format="webp"`; a real tile returns `image/webp`; a `..` path-traversal attempt is rejected (404) |
| Invalid file upload (plain text) | 400 with a clear message, temp file cleaned up, no orphaned asset/job rows |
| **Crash recovery** | Manually set a job to `processing` with a lease expired 5 minutes ago (simulating a killed worker), restarted the worker — it reclaimed the job (`attempts` incremented 1→2), reprocessed it, and the asset reached `ready` with no corruption |
| Second upload to the same map | Correctly assigned `generation: 2`, wrote tiles to a separate versioned directory, didn't touch generation 1's files |
| Browser end-to-end | `/maps/new` → create + upload → auto-redirect → polling UI → rendered viewer with pan/zoom/fullscreen/navigator, via `claude-in-chrome` |
| `npm run test` / `npm run lint` / `npm run build` | All clean |

## Notes / deviations from the plan doc

- The plan's asset-processing pipeline runs one image at a time in a single worker — implemented via poll interval (1s) rather than a push/notify mechanism. Fine at this scale; revisit only if upload-to-ready latency becomes noticeable with real (larger, more complex) source images.
- `/maps/new` and the polling status view on `/maps/[mapId]` are deliberately minimal — real map creation/editing UI (categories, hierarchy, breadcrumbs) is Batch 3's job.
- Resumable uploads are still out of scope per the plan ("can wait unless actual file sizes justify them") — an interrupted upload's temp file is simply discarded on next launcher start.
- `scripts/simulate-stuck-job.mjs` was added as a standing dev tool to re-test crash recovery on demand (injects a job stuck in `processing` with an expired lease).

## Ready for Batch 3

Map management: the real create/edit UI, categories, hierarchy with breadcrumbs, reparenting (already has cycle protection from Batch 1), and trash.
