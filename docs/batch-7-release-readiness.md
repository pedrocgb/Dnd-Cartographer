# Batch 7 — Release Readiness

Date: 2026-09-16

Machine: this dev machine (Windows 11, corporate-managed), Node.js v24.21.0, Chrome via `claude-in-chrome` automation. All numbers below are from this one machine only — re-measure on the actual deployment hardware before treating any figure as a hard guarantee.

## What this batch actually tested

Unlike earlier batches, this one didn't add features — it exercised the **real production path** (full build + `next start` + worker, not `next dev`) for the first time this project, specifically to catch anything dev mode's extra safety nets or hot-reload forgiveness would hide. It found two real bugs.

## Bugs found and fixed

1. **Markers could silently fail to render at all — a genuine race condition.** `MapWorkspace` called `setViewer(v)` immediately after constructing the OpenSeadragon viewer, before the tile source had actually opened. `MarkerLayer` checks `viewer.world.getItemAt(0)` as soon as `viewer` is set; if that ran before the image attached, it silently bailed and — since `viewer`/`osd` never change again afterward — **never retried**. Result: a map's markers would sometimes render fine, and sometimes render zero markers with no error, no console message, nothing — purely dependent on load timing. Reproduced deterministically on a fresh map (0/100 markers rendered, repeatably, even though the API correctly returned all 100). Fixed by waiting for OSD's `open` event before publishing `viewer` to React state. Re-tested with multiple fresh reloads afterward — 100/100 every time.
2. **Concurrent database writes crashed the entire worker process.** Seeding markers via bulk concurrent API requests while an image was tiling produced `SQLITE_BUSY: database is locked`, thrown from inside the worker's own error-handling path (`markJobFailed`), which was itself unhandled — killing the whole Node process outright (confirmed via `Get-CimInstance` showing zero matching processes afterward). This is exactly the "write contention between the web process and worker" the plan calls out as needing bounded handling. Fixed two ways: (a) `PRAGMA busy_timeout = 5000` on every SQLite connection, so one process's write waits up to 5s for the other's lock instead of failing instantly; (b) defense in depth in the worker — every DB call in the poll loop, including the failure-recording path itself, is now wrapped so a transient error can never escape the loop, plus a top-level restart-on-crash wrapper as a last resort. **Reproduced the original crash scenario again afterward** (fresh upload + 2,000 concurrent marker-creation requests racing the tiling job) — no crash, worker stayed alive and the asset still reached `ready`.

Neither of these would have been caught by dev-mode testing alone; both needed the production build/start path and, for the second one, genuine concurrent load.

## Performance benchmarks (production build)

| Scenario | Result |
| --- | --- |
| Tiling the confirmed benchmark image (7,680×4,320) through the real worker | 1.52s, 779 KiB of tiles on disk |
| 100 markers, active pan (production `MarkerLayer`, not the Batch 0 spike's simplified renderer) | Steady 60 FPS |
| 1,000 markers, idle | 58 FPS |
| 1,000 markers, active pan | 25 FPS → **36 FPS** after adding `will-change: transform` to marker overlays (a real, measured ~44% improvement, not just a guess) |
| 5,000 markers, active pan (stress test, not a target) | ~16 FPS, and only 4,923/5,000 markers had mounted after several seconds |

**Interpretation:** the plan's own benchmark table calls 1,000 "a proposed target until real density is known" and 5,000 explicitly "a benchmark to identify scaling limits... not a confirmed user requirement." That's exactly what these numbers show: comfortable at realistic personal-worldbuilding density (dozens to ~100 markers/map), degraded but usable at 1,000, and genuinely struggling at 5,000. The production `MarkerLayer` (real drag-and-drop, hover, per-marker React roots) is measurably slower than the Batch 0 spike's simplified renderer at the same counts — worth knowing before assuming the spike's numbers still apply. If real usage regularly approaches four figures of markers on one map, the plan's own fallback — a canvas-based marker renderer — is the right next step, not a micro-optimization pass.

Tiling numbers still carry the Batch 0 caveat: the benchmark image is synthetic (flat-colored, highly compressible) and tiles far faster/smaller than a real painted map would.

## Offline use

Verified by static audit rather than a live network cutoff (no offline-emulation tool was available in this session):

- No external URLs in application source (`grep -rn "https\?://" src/` finds only local `URL()` parsing helpers, not fetches).
- `next/font/google` (Geist) is self-hosted after build — confirmed `.woff2` files present in the build output; no Google Fonts CDN call happens at runtime.
- OpenSeadragon's UI images are copied into `public/osd-images/` and referenced locally (`prefixUrl: "/osd-images/"`), not loaded from a CDN.
- Lucide icons, Tiptap, and every other dependency are bundled via npm at build time, not loaded remotely.

## Local startup / shutdown

- One command (`npm run launch`) migrates, cleans up orphans, builds, and starts both the server and worker — verified working end-to-end multiple times this batch, including a from-cold start.
- Bound to `127.0.0.1` only — reconfirmed via `netstat` on the production path (not just dev, which was already checked in Batch 1).
- `Ctrl+C` signals both children to stop (`SIGINT`/`SIGTERM` handlers in `launch.mjs`).
- `README.md` now documents all of this for a first-time user, plus the known constraints above.

## Verified

| Check | Result |
| --- | --- |
| Full production launch (`npm run launch`) | Migrates, builds, starts server + worker, all from cold |
| Loopback binding in production | `netstat` shows `127.0.0.1:3000` only |
| Marker race condition | Fixed; confirmed with repeated fresh reloads, 100/100 every time |
| Worker crash under write contention | Fixed; reproduced the original failure scenario again post-fix, no crash |
| `npm run test` (17) / `lint` / `build` | All clean |

## Ready for release

All seven batches from the roadmap are complete. Remaining work is exactly what the roadmap and this batch's findings call out as follow-ups, not blockers for personal use: re-measuring performance with a real (non-synthetic) map image, and a canvas-based marker renderer if real marker density grows past what's comfortable today.
