import { NextResponse } from "next/server";
import { parseTrashRefs } from "@/server/trash/trash";
import { inWorldTrash } from "@/server/trash/list";
import { requireWorldId } from "@/server/world/active-world";
import { restoreItems } from "@/server/trash/restore";
import { serverT } from "@/i18n/server";

/** Body: `{ items: [{ kind, id }] }`. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const refs = parseTrashRefs(body?.items);
  if (!refs) return NextResponse.json({ error: (await serverT("trash"))("error.invalidItems") }, { status: 400 });
  await restoreItems(await inWorldTrash(await requireWorldId(), refs));
  return NextResponse.json({ ok: true });
}
