# World Wiki — Maps

A local, single-user map & marker workspace for worldbuilding: upload map artwork, organize it into a hierarchy, and place editable markers with rich descriptions. Runs entirely on localhost — no account, no cloud, no internet required after the initial build.

## Requirements

- Node.js 22+ (built-in `node:sqlite`-adjacent tooling and modern JS features are assumed; developed and tested against Node 24)
- No database server, no Docker, no cloud account — everything lives in one local data directory.

## First run

```bash
npm install
npm run launch
```

This one command:

1. Applies any pending database migrations.
2. Cleans up orphaned upload/tile artifacts from a previous crash.
3. Builds the app for production.
4. Starts the web server and the image-processing worker together, bound to `127.0.0.1` only.

Then open **http://127.0.0.1:3000**.

To stop it, press `Ctrl+C` in the terminal running `npm run launch` — this signals both the server and the worker to shut down.

## Everyday development

```bash
npm run launch:dev
```

Same as above, but skips the production build and runs Next.js in dev mode (hot reload) instead. Use this while making changes; use `npm run launch` for normal day-to-day use once a change is done.

## Where your data lives

Everything persistent — the database, uploaded images, generated tiles/thumbnails — lives in a data directory **outside this repository**, so re-cloning, rebuilding, or `git clean`-ing the repo never touches it:

- Default: `~/.world-wiki-maps/data` (i.e. `C:\Users\<you>\.world-wiki-maps\data` on Windows)
- Override with the `WORLD_WIKI_DATA_DIR` environment variable if you want it somewhere else.

## Backup and restore

```bash
npm run backup -- <destination-directory>
npm run restore -- <backup-directory> <new-data-directory>
```

Backup is safe to run while the app is live — it uses SQLite's `VACUUM INTO` for a consistent snapshot rather than copying the database file directly. Restore copies a backup into a fresh (must-be-empty) data directory; point `WORLD_WIKI_DATA_DIR` at it to use it.

## Sample data

This repo ships a `seed-data/` snapshot (database + images) captured with `npm run backup`. To start with it instead of an empty workspace:

```bash
npm run restore -- ./seed-data ~/.world-wiki-maps/data
```

(On Windows, use the actual path, e.g. `C:\Users\<you>\.world-wiki-maps\data`, or set `WORLD_WIKI_DATA_DIR` to point wherever you'd like it restored.) The target directory must not already exist or must be empty.

## Export and import a world

Use the **Export** / **Import** links in the app's nav bar. Export downloads one JSON file containing your maps, markers, hierarchy, descriptions, and images. Import adds everything from a file into your current workspace as new items (fresh ids throughout, so nothing existing is ever overwritten) and re-generates tiles for any included images in the background.

## Other scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server only (no worker, no migration) — rarely what you want directly; prefer `launch:dev`. |
| `npm run worker` | Runs just the image-processing worker, useful if you're restarting it independently of the web server. |
| `npm run db:migrate` | Applies pending database migrations without starting anything else. |
| `npm run cleanup` | Removes orphaned tile/thumbnail directories left by an interrupted job. |
| `npm run test` | Runs the unit test suite (Vitest). |
| `npm run lint` | Runs ESLint. |
| `npm run build` | Production build only. |

## Known constraints (first release)

- **Single user, single workspace.** There's no login, no sharing, and imports merge into your one active workspace rather than creating a separate world — see `docs/batch-6-reliability.md` for why.
- **Marker rendering at high density.** Each marker is an independently interactive DOM element. Measured on the development machine: ~100 markers on a map holds a steady 60 FPS while panning; ~1,000 drops to ~35–40 FPS; ~5,000 (a stress test, not an expected real-world count) drops further, to ~15 FPS. Typical personal-worldbuilding marker counts per map are comfortably fast; a canvas-based renderer would be the follow-up if real usage regularly approaches four figures per map. Full numbers in `docs/batch-7-release-readiness.md`.
- **Tiling performance numbers use a synthetic benchmark image** (flat-colored, highly compressible), not a real painted map — re-measure with actual artwork before treating the recorded tiling time/disk-usage numbers as a hard ceiling.
- Full per-batch implementation notes, including bugs found and fixed along the way, are in `docs/batch-0-*.md` through `docs/batch-7-*.md`.
