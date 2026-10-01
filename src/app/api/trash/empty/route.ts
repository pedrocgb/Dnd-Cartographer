import { NextResponse } from "next/server";
import { ensureDefaultWorld } from "@/server/world/default-world";
import { listTrash } from "@/server/trash/list";
import { purgeItems } from "@/server/trash/purge";

/** Permanently deletes everything in the Trash. */
export async function POST() {
  const items = await listTrash(await ensureDefaultWorld());
  if (items.length === 0) return NextResponse.json({ purged: 0, skipped: [] });
  try {
    return NextResponse.json(await purgeItems(items.map(({ kind, id }) => ({ kind, id }))));
  } catch (err) {
    console.error("[trash] empty failed:", err);
    return NextResponse.json({ error: "Couldn't empty the Trash. Nothing was removed." }, { status: 500 });
  }
}
