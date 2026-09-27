import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { fronts } from "@/server/db/schema";
import { ensureDefaultWorld } from "@/server/world/default-world";
import { badRequest, calendarErrorResponse, notFound, readBody } from "@/server/calendars/respond";
import { campaignOf } from "@/server/sessions/store";
import { frontFields } from "@/server/quests/front-fields";
import { frontsOf, toClientFront } from "@/server/quests/store";

type RouteContext = { params: Promise<{ id: string }> };

/** The campaign's live fronts, in order. */
export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  if (!(await campaignOf(await ensureDefaultWorld(), id))) return notFound("Campaign not found.");
  return NextResponse.json({ fronts: (await frontsOf(id)).map(toClientFront) });
}

/** Creates a front at the end of the list. */
export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const worldId = await ensureDefaultWorld();
  if (!(await campaignOf(worldId, id))) return notFound("Campaign not found.");
  const body = await readBody(request);
  if (!body) return badRequest("Invalid request body.");
  if (!("name" in body)) return badRequest("A front needs a name.");
  try {
    const fields = frontFields(body);
    const existing = await frontsOf(id);
    const [row] = await db
      .insert(fronts)
      .values({ ...fields, name: fields.name!, sortOrder: fields.sortOrder ?? existing.reduce((max, f) => Math.max(max, f.sortOrder + 1), 0), worldId, campaignId: id })
      .returning();
    return NextResponse.json({ front: toClientFront(row) }, { status: 201 });
  } catch (error) {
    return calendarErrorResponse(error);
  }
}
