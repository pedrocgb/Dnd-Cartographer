import { NextResponse } from "next/server";
import { requireWorldId } from "@/server/world/active-world";
import { listTrash } from "@/server/trash/list";
import { describePurgeResult, purgeItems } from "@/server/trash/purge";
import { serverT } from "@/i18n/server";

/** Permanently deletes everything in the Trash. */
export async function POST() {
  const t = await serverT("trash");
  const items = await listTrash(await requireWorldId());
  if (items.length === 0) return NextResponse.json({ purged: 0, skipped: [] });
  try {
    return NextResponse.json(describePurgeResult(await purgeItems(items.map(({ kind, id }) => ({ kind, id }))), t));
  } catch (err) {
    console.error("[trash] empty failed:", err);
    return NextResponse.json({ error: t("error.emptyFailed") }, { status: 500 });
  }
}
