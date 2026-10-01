import { NextResponse } from "next/server";
import { parseTrashRefs } from "@/server/trash/trash";
import { purgeItems } from "@/server/trash/purge";

/** Body: `{ items: [{ kind, id }] }`. Permanent: only trashed items are deleted. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const refs = parseTrashRefs(body?.items);
  if (!refs) return NextResponse.json({ error: "Invalid items." }, { status: 400 });
  try {
    return NextResponse.json(await purgeItems(refs));
  } catch (err) {
    console.error("[trash] purge failed:", err);
    return NextResponse.json({ error: "Couldn't delete these items. Nothing was removed." }, { status: 500 });
  }
}
