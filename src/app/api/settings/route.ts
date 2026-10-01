import { NextResponse } from "next/server";
import { ensureDefaultWorld } from "@/server/world/default-world";
import { sanitizeSettingsPatch } from "@/server/settings/settings";
import { getSettings, updateSettings } from "@/server/settings/store";

export async function GET() {
  const worldId = await ensureDefaultWorld();
  return NextResponse.json({ settings: await getSettings(worldId) });
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  const result = sanitizeSettingsPatch(body);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  const worldId = await ensureDefaultWorld();
  return NextResponse.json({ settings: await updateSettings(worldId, result.patch) });
}
