import { NextResponse } from "next/server";
import { requireWorldId } from "@/server/world/active-world";
import { importBundle, ImportValidationError } from "@/server/portability/import-export";
import { serverT } from "@/i18n/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const t = await serverT("errors");
  const body = await request.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: t("importNotJson") }, { status: 400 });
  }

  const worldId = await requireWorldId();

  try {
    const summary = await importBundle(parsed, worldId);
    return NextResponse.json({ summary }, { status: 201 });
  } catch (err) {
    if (err instanceof ImportValidationError) {
      return NextResponse.json({ error: t(err.key, err.params) }, { status: 400 });
    }
    throw err;
  }
}
