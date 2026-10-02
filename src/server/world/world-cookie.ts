/** The cookie holding the id of the world this browser has open (set on the worlds screen). No server imports: src/proxy.ts reads it. */
export const WORLD_COOKIE = "world";

/** Options for setting WORLD_COOKIE: one year, sent with every same-site request, not readable by scripts. */
export const WORLD_COOKIE_OPTIONS = { httpOnly: true, sameSite: "lax", path: "/", maxAge: 365 * 24 * 3600 } as const;

/** Paths that work with no world open: the worlds screen, its API, the app-wide settings, Next's own files and static files from public/. */
export const WORLD_FREE_PATHS = [/^\/worlds(\/|$)/, /^\/api\/(worlds|settings)(\/|$)/, /^\/_next\//, /^\/(?!api\/).*\.[a-z0-9]+$/i];
