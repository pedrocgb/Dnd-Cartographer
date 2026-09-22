import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { resolveAssetPath } from "@/server/storage/storage-adapter";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: pathSegments } = await params;
  if (pathSegments.some((segment) => segment === "..")) {
    return NextResponse.json({ error: "Invalid path." }, { status: 400 });
  }

  try {
    const data = await readFile(resolveAssetPath("portraits", pathSegments.join("/")));
    return new NextResponse(data, {
      headers: {
        "Content-Type": "image/webp",
        // A re-upload overwrites the same key, so this can't be marked
        // immutable like map tiles — short-lived caching only.
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch {
    return NextResponse.json({ error: "Portrait not found." }, { status: 404 });
  }
}
