# Batch 1 — Foundation

Date: 2026-09-16

## What was built

- **Data directory** (`src/server/data-dir.ts`) — resolves a persistent data directory outside the repo, defaulting to `~/.world-wiki-maps/data`, overridable via `WORLD_WIKI_DATA_DIR`. Creates `originals/`, `tiles/`, `thumbnails/`, `temp/`, `exports/` subdirectories and holds the SQLite file.
- **Storage adapter** (`src/server/storage/storage-adapter.ts`) — resolves relative asset keys to real paths per category, rejecting path traversal. Callers never touch raw filesystem paths.
- **Database** (`src/server/db/schema.ts`, `client.ts`) — Drizzle ORM over `@libsql/client` (chosen over `better-sqlite3`: this machine has no C++ build tools installed and no admin path to add them, so a driver requiring native compilation was a non-starter; libsql ships prebuilt bindings). Schema covers all 8 tables from the plan's data model: worlds, rich documents, map categories, marker categories, maps, map assets, processing jobs, markers. Foreign-key enforcement (`PRAGMA foreign_keys = ON`) is set on every connection.
- **Migrations** — generated via `drizzle-kit generate` into `drizzle/`, applied via `scripts/migrate.mjs` (`npm run db:migrate`), also run automatically by the launcher.
- **Map hierarchy protection** (`src/server/maps/hierarchy.ts`, `reparent.ts`) — pure `validateReparent()` rejects self-parenting, cycles (direct and deep), cross-world links, and unknown ids; wrapped in a DB transaction (`reparentMap()`) that re-checks inside the transaction so concurrent reparents can't jointly create a cycle. Covered by 7 unit tests (`tests/hierarchy.test.ts`), all passing.
- **Worker module boundary** (`src/worker/index.ts`) — placeholder entry point; Batch 2 fills in the actual job consumer.
- **Local launcher** (`scripts/launch.mjs`, `npm run launch` / `launch:dev`) — one command that ensures the data directory exists, runs migrations, then starts Next.js bound explicitly to `127.0.0.1`.
- **Loopback boundary** (`src/proxy.ts`, Next.js's proxy/middleware convention) — rejects any request whose Host header isn't `localhost`/`127.0.0.1`/`[::1]` (403), and rejects cross-origin mutating requests (POST/PUT/PATCH/DELETE with a non-loopback Origin).

## Verified

| Check | Result |
| --- | --- |
| `npm run launch:dev` | Migrates, then binds to `127.0.0.1:3000` only (confirmed via `netstat` — no `0.0.0.0` listener) |
| Request with real Host header | 200 |
| Request with spoofed `Host: evil.example.com` | 403 |
| `npm run test` (hierarchy/cycle protection) | 7/7 passing |
| `npm run build` | Clean production build, TypeScript checks pass |
| `npm run lint` | Clean |

## Notes / deviations from the plan doc

- Swapped `better-sqlite3` → `@libsql/client` for the SQLite driver. Same relational/transactional guarantees via Drizzle; avoids a native-compilation dependency this machine can't satisfy without admin-level tooling installs. Revisit only if a concrete libsql limitation surfaces.
- Next.js 16 renamed the middleware convention to "proxy" (`src/proxy.ts`, exporting `proxy()` instead of `middleware()`) — used the current convention directly rather than the deprecated one.

## Ready for Batch 2

Upload sessions, worker queue, processing states, and real DZI tile serving through a validated API route (replacing the spike's static `public/tiles` shortcut).
