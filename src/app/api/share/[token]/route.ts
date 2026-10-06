import { NextResponse } from "next/server";
import { loadShare } from "@/server/share/load";

export const runtime = "nodejs";

/** Public: the live, read-only view behind a share link (no world cookie; the link's own world). */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const share = await loadShare((await params).token);
  if (!share) return NextResponse.json({ error: "This link is no longer available." }, { status: 404 });
  return NextResponse.json({ view: share.view }, { headers: { "Cache-Control": "no-store" } });
}
