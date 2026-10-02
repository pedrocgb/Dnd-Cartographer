import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { worlds } from "@/server/db/schema";
import { notFound } from "@/server/calendars/respond";
import { WORLD_COOKIE, WORLD_COOKIE_OPTIONS } from "@/server/world/world-cookie";
import { worldById } from "@/server/world/worlds";

/** Opens a world in this browser: every page and request after this reads it. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await worldById(id))) return notFound("World not found.");
  await db.update(worlds).set({ lastOpenedAt: new Date() }).where(eq(worlds.id, id));
  (await cookies()).set(WORLD_COOKIE, id, WORLD_COOKIE_OPTIONS);
  return NextResponse.json({ ok: true });
}
