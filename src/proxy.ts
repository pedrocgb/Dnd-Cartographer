import { NextResponse, type NextRequest } from "next/server";

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

  return NextResponse.next();
}

export const config = {
  matcher: "/:path*",
};
