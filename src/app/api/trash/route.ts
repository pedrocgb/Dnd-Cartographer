import { NextResponse } from "next/server";
import { requireWorldId } from "@/server/world/active-world";
import { listTrash } from "@/server/trash/list";
import { maybeAutoPurge } from "@/server/trash/auto-purge";

/** Every trashed item (the page searches, filters and sorts it); applies the retention setting first. */
export async function GET() {
  const worldId = await requireWorldId();
  await maybeAutoPurge();
  return NextResponse.json({ items: await listTrash(worldId) });
}
