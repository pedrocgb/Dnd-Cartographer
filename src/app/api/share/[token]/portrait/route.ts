import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { resolveAssetPath } from "@/server/storage/storage-adapter";
import { loadShare } from "@/server/share/load";

export const runtime = "nodejs";

/** Public: the shared article's image. */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const share = await loadShare((await params).token);
  if (!share?.portraitKey) return NextResponse.json({ error: "Image not found." }, { status: 404 });
  try {
    return new NextResponse(await readFile(resolveAssetPath("portraits", share.portraitKey)), { headers: { "Content-Type": "image/webp", "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  }
}
