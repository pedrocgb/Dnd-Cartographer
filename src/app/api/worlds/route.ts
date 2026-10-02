import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { badRequest, readBody } from "@/server/calendars/respond";
import { WORLD_COOKIE, WORLD_COOKIE_OPTIONS } from "@/server/world/world-cookie";
import { createWorld, listWorlds, parseWorldFields } from "@/server/world/worlds";

/** Every world (with counts), and which one this browser has open. */
export async function GET() {
  const active = (await cookies()).get(WORLD_COOKIE)?.value ?? null;
  const list = await listWorlds();
  return NextResponse.json({ worlds: list, activeId: list.some((w) => w.id === active) ? active : null });
}

/** Creates an empty world `{ name, description, icon?, color? }` and opens it in this browser. */
export async function POST(request: Request) {
  const body = await readBody(request);
  if (!body) return badRequest("Invalid request body.");
  const fields = parseWorldFields(body, false);
  if ("error" in fields) return badRequest(fields.error);
  const world = await createWorld({ ...fields, name: fields.name! });
  (await cookies()).set(WORLD_COOKIE, world.id, WORLD_COOKIE_OPTIONS);
  return NextResponse.json({ world: { id: world.id, name: world.name, icon: world.icon, color: world.color } }, { status: 201 });
}
