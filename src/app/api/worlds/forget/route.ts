import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { WORLD_COOKIE } from "@/server/world/world-cookie";

/** Forgets this browser's open world (e.g. one deleted from another browser), so the worlds screen comes next. */
export async function POST() {
  (await cookies()).delete(WORLD_COOKIE);
  return NextResponse.json({ ok: true });
}
