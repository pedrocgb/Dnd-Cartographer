import { NextResponse } from "next/server";
import { parseTrashRefs } from "@/server/trash/trash";
import { inWorldTrash } from "@/server/trash/list";
import { requireWorldId } from "@/server/world/active-world";
import { describePurgeResult, purgeItems } from "@/server/trash/purge";
import { serverT } from "@/i18n/server";

/** Body: `{ items: [{ kind, id }] }`. Permanent: only trashed items are deleted. */
export async function POST(request: Request) {
  const t = await serverT("trash");
  const body = await request.json().catch(() => null);
  const refs = parseTrashRefs(body?.items);
  if (!refs) return NextResponse.json({ error: t("error.invalidItems") }, { status: 400 });
  try {
    return NextResponse.json(describePurgeResult(await purgeItems(await inWorldTrash(await requireWorldId(), refs)), t));
  } catch (err) {
    console.error("[trash] purge failed:", err);
    return NextResponse.json({ error: t("error.purgeFailed") }, { status: 500 });
  }
}
