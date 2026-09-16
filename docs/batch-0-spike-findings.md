# Batch 0 — Technical Spike Findings

Date: 2026-09-16
Machine: this dev machine (Windows, corporate-managed), Chrome via claude-in-chrome automation.

## What was built

- `scripts/generate-sample.mjs` — generates a synthetic 7,680 × 4,320 px benchmark map (grid cells with coordinate labels, city labels at multiple font sizes) via sharp/SVG, written to `data/originals/sample-map.png`.
- `scripts/tile-sample.mjs` — tiles that image into a DZI pyramid via `sharp().tile()` (512px tiles, 1px overlap, WebP), written to `data/tiles/`, timed and measured.
- `src/components/MapSpike.tsx` + `src/app/spike/page.tsx` — OpenSeadragon viewer at `/spike` serving tiles from `public/tiles` (copied from `data/tiles` for this spike only — real batches serve through a validated API route per the plan, not raw `public/`). Renders 0 / 1,000 / 5,000 synthetic markers as fixed-screen-size overlays, positioned via `tiledImage.imageToViewportCoordinates(u * width, v * height)` (confirms the plan's warning that OSD viewport x/y aren't independently normalized — this conversion is required). A cluster of ~20 markers is placed at identical coordinates to exercise overlap. HUD shows live FPS and JS heap size.

## Results

| Check | Result |
| --- | --- |
| Tiling time (7,680×4,320 synthetic PNG) | 0.86s, sharp/libvips |
| Tile pyramid size on disk | 0.81 MiB |
| Source image size | 0.96 MiB |
| Viewer load | Tiles load correctly; pan/zoom/fullscreen/navigator all work |
| Marker anchoring | Markers stay pixel-anchored to image coordinates through zoom and pan; fixed on-screen size confirmed (28px regardless of zoom level) |
| 1,000 markers | Steady 60 FPS during pan/zoom |
| 5,000 markers | 49–53 FPS during pan/zoom — noticeably lower but still interactive |
| Overlap cluster | Renders correctly; individual markers remain distinguishable/clickable at sufficient zoom |
| JS heap | ~14 MB at 1,000 markers, ~16–21 MB at 5,000 markers (Chrome `performance.memory`, dev build) |
| Console | No errors |

**Caveat on tiling numbers:** the synthetic sample is a flat-color/vector-style SVG rendered to PNG, which compresses and tiles far faster/smaller than a real painted or photographic map raster. Tiling time and disk usage here are a pipeline correctness check, not a performance ceiling — re-measure with an actual painted map before treating any number above as a release gate.

## Renderer decision

**Fixed-size DOM overlays (OpenSeadragon's built-in overlay API) are sufficient for the first release.** 5,000 markers still ran at ~50 FPS with no architectural changes needed. The canvas-based marker renderer described as a fallback in the plan is not required unless real-world marker density substantially exceeds 5,000 per map, or profiling on lower-end hardware shows a problem this synthetic test didn't surface (this test ran on one dev machine only).

## Confirmed before proceeding to Batch 1

- Tiling pipeline (sharp → DZI) works end-to-end.
- OpenSeadragon viewer + fixed overlay markers work end-to-end, including the image-coordinate conversion gotcha.
- No architectural blockers found. Proceed to Batch 1 (foundation: app structure, launcher, SQLite schema/migrations, storage adapter) using this stack as planned.

## Known gaps intentionally left for later batches

- Tiles are served from `public/` (static) for this spike only; Batch 2 must serve them through a validated API route with asset IDs, not raw filesystem paths.
- No real (non-synthetic) large map has been tested yet — do this before finalizing any performance-based release gate (see roadmap's Batch 7 benchmarks).
- No mobile/touch testing performed.
