import { NextResponse } from "next/server";
import { sanitizeSettingsPatch } from "@/server/settings/settings";
import { getSettings, updateSettings } from "@/server/settings/store";

/** App-wide preferences, shared by every world (so they also work with no world open). */
export async function GET() {
  return NextResponse.json({ settings: await getSettings() });
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  const result = sanitizeSettingsPatch(body);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ settings: await updateSettings(result.patch) });
}
