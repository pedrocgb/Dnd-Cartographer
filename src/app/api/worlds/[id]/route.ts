import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { worlds } from "@/server/db/schema";
import { badRequest, notFound, readBody } from "@/server/calendars/respond";
import { WORLD_COOKIE } from "@/server/world/world-cookie";
import { parseWorldFields, worldById } from "@/server/world/worlds";
import { deleteWorld, worldIsBusy } from "@/server/world/delete-world";

type RouteContext = { params: Promise<{ id: string }> };

/** Renames a world or changes its description. */
export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  if (!(await worldById(id))) return notFound("World not found.");
  const body = await readBody(request);
  if (!body) return badRequest("Invalid request body.");
  const fields = parseWorldFields(body, true);
  if ("error" in fields) return badRequest(fields.error);
  const [row] = await db.update(worlds).set({ ...fields, updatedAt: new Date() }).where(eq(worlds.id, id)).returning();
  return NextResponse.json({ world: { id: row.id, name: row.name, description: row.description, icon: row.icon, color: row.color } });
}

/** Deletes a world and everything in it, for good. Body: `{ confirmName }`, the world's exact name. */
export async function DELETE(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const world = await worldById(id);
  if (!world) return notFound("World not found.");
  const body = await readBody(request);
  if (body?.confirmName !== world.name) return badRequest("Type the world's name exactly to delete it.");
  if (await worldIsBusy(id)) return NextResponse.json({ error: "One of this world's map images is still being processed. Try again in a moment." }, { status: 409 });
  await deleteWorld(id);
  const store = await cookies();
  if (store.get(WORLD_COOKIE)?.value === id) store.delete(WORLD_COOKIE);
  return NextResponse.json({ ok: true });
}
