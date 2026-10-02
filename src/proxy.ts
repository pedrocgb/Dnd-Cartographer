import { NextResponse, type NextRequest } from "next/server";
import { WORLD_COOKIE, WORLD_FREE_PATHS } from "./server/world/world-cookie";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function hostnameOf(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value.includes("://") ? value : `http://${value}`).hostname;
  } catch {
    return null;
  }
}

export function proxy(request: NextRequest) {
  const host = hostnameOf(request.headers.get("host"));
  if (!host || !LOOPBACK_HOSTS.has(host)) {
    return new NextResponse("This application only serves local requests.", {
      status: 403,
    });
  }

  if (MUTATING_METHODS.has(request.method)) {
    const origin = request.headers.get("origin");
    if (origin) {
      const originHost = hostnameOf(origin);
      if (!originHost || !LOOPBACK_HOSTS.has(originHost)) {
        return new NextResponse("Cross-origin mutation rejected.", { status: 403 });
      }
    }
  }

  // Everything else belongs to a world: with none open, pages go to the worlds screen and the API refuses.
  const path = request.nextUrl.pathname;
  if (!request.cookies.get(WORLD_COOKIE)?.value && !WORLD_FREE_PATHS.some((re) => re.test(path))) {
    if (path.startsWith("/api/")) return NextResponse.json({ error: "Choose a world first.", noWorld: true }, { status: 409 });
    return NextResponse.redirect(new URL("/worlds", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/:path*",
};
