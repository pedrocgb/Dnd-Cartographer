import { NextResponse } from "next/server";
import { ensureDefaultWorld } from "@/server/world/default-world";
import { listTrash } from "@/server/trash/list";
import { maybeAutoPurge } from "@/server/trash/auto-purge";

/** Every trashed item (the page searches, filters and sorts it); applies the retention setting first. */
export async function GET() {
  const worldId = await ensureDefaultWorld();
  await maybeAutoPurge(worldId);
  return NextResponse.json({ items: await listTrash(worldId) });
}
