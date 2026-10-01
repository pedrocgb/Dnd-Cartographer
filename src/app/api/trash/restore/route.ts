import { NextResponse } from "next/server";
import { parseTrashRefs } from "@/server/trash/trash";
import { restoreItems } from "@/server/trash/restore";

/** Body: `{ items: [{ kind, id }] }`. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const refs = parseTrashRefs(body?.items);
  if (!refs) return NextResponse.json({ error: "Invalid items." }, { status: 400 });
  await restoreItems(refs);
  return NextResponse.json({ ok: true });
}
