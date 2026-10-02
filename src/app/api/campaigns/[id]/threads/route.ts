import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { plotThreads } from "@/server/db/schema";
import { requireWorldId } from "@/server/world/active-world";
import { badRequest, calendarErrorResponse, notFound, readBody } from "@/server/calendars/respond";
import { campaignOf } from "@/server/sessions/store";
import { threadFields } from "@/server/writer/fields";
import { threadsOf, toClientThread, writerContextOf } from "@/server/writer/store";

type RouteContext = { params: Promise<{ id: string }> };

/** Adds a thread (a promise by default) at the end of the list. */
export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const worldId = await requireWorldId();
  if (!(await campaignOf(worldId, id))) return notFound("Campaign not found.");
  const body = await readBody(request);
  if (!body) return badRequest("Invalid request body.");
  if (!("name" in body)) return badRequest("Give the thread a name.");
  try {
    const fields = threadFields(body, await writerContextOf(id));
    const sortOrder = fields.sortOrder ?? (await threadsOf(id)).reduce((max, t) => Math.max(max, t.sortOrder + 1), 0);
    const [row] = await db
      .insert(plotThreads)
      .values({ ...fields, name: fields.name!, miceType: fields.kind === "mice" ? (fields.miceType ?? "inquiry") : null, sortOrder, worldId, campaignId: id })
      .returning();
    return NextResponse.json({ thread: toClientThread(row) }, { status: 201 });
  } catch (error) {
    return calendarErrorResponse(error);
  }
}
