import { NextResponse } from "next/server";
import { fullPortrait } from "@/server/assets/portrait-upload";
import { loadShare } from "@/server/share/load";

export const runtime = "nodejs";

/** Public: the shared article's image, whole (the portrait route serves the crop). */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const share = await loadShare((await params).token);
  if (!share?.portraitKey) return NextResponse.json({ error: "Image not found." }, { status: 404 });
  try {
    return new NextResponse(new Uint8Array(await fullPortrait(share.portraitKey)), { headers: { "Content-Type": "image/webp", "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  }
}
