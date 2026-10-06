import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { shareLinks } from "@/server/db/schema";
import { requireWorldId } from "@/server/world/active-world";
import { activeShare, newShareToken, parseShareTarget, shareTargetExists, toClientShare } from "@/server/share/load";

/** The target's active share link (`?kind=&template=&id=`), or null. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const target = parseShareTarget({ kind: params.get("kind"), template: params.get("template"), id: params.get("id") });
  if (!target) return NextResponse.json({ error: "Invalid share target." }, { status: 400 });
  const worldId = await requireWorldId();
  const share = await activeShare(worldId, target.kind, target.id);
  return NextResponse.json({ share: share ? toClientShare(share) : null });
}

/** Creates the target's share link `{ kind, template?, id }`, or returns the active one. */
export async function POST(request: Request) {
  const target = parseShareTarget(await request.json().catch(() => null));
  if (!target) return NextResponse.json({ error: "Invalid share target." }, { status: 400 });
  const worldId = await requireWorldId();
  if (!(await shareTargetExists(worldId, target))) return NextResponse.json({ error: "Nothing to share: it no longer exists." }, { status: 404 });
  const existing = await activeShare(worldId, target.kind, target.id);
  if (existing) return NextResponse.json({ share: toClientShare(existing) });
  const [row] = await db
    .insert(shareLinks)
    .values({ worldId, token: newShareToken(), targetKind: target.kind, targetTemplate: target.kind === "article" ? target.template : null, targetId: target.id })
    .returning();
  return NextResponse.json({ share: toClientShare(row) }, { status: 201 });
}
