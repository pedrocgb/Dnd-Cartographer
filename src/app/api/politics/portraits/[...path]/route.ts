import { NextResponse } from "next/server";
import { readFile, stat } from "node:fs/promises";
import { resolveAssetPath } from "@/server/storage/storage-adapter";
import { errorResponse } from "@/i18n/server";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: pathSegments } = await params;
  if (pathSegments.some((segment) => segment === "..")) {
    return errorResponse("invalidPath", 400);
  }

  try {
    const file = resolveAssetPath("portraits", pathSegments.join("/"));
    const { mtimeMs, size } = await stat(file);
    const etag = `"${Math.floor(mtimeMs).toString(36)}-${size.toString(36)}"`;
    // A re-upload overwrites the same key, so this can't be marked immutable
    // like map tiles. Instead the browser shows its copy at once and checks
    // it in the background (a 304 when unchanged); the article pages also
    // change the ?v= on every re-upload, so they never show a stale image.
    const headers = { "Content-Type": "image/webp", "Cache-Control": "public, max-age=300, stale-while-revalidate=604800", ETag: etag };
    if (request.headers.get("if-none-match") === etag) return new NextResponse(null, { status: 304, headers });
    return new NextResponse(await readFile(file), { headers });
  } catch {
    return errorResponse("portraitNotFound", 404);
  }
}
