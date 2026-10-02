import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { fronts, quests } from "@/server/db/schema";
import { requireWorldId } from "@/server/world/active-world";
import { badRequest, calendarErrorResponse, notFound, readBody } from "@/server/calendars/respond";
import { frontFields } from "@/server/quests/front-fields";
import { frontOf, toClientFront } from "@/server/quests/store";

type RouteContext = { params: Promise<{ id: string }> };

const stale = () => NextResponse.json({ error: "This front was changed elsewhere. Reload it and try again.", stale: true }, { status: 409 });

/** Edits a front (`expectedVersion` required); "Advance" is a portents + clock edit. */
export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const row = await frontOf(await requireWorldId(), id);
  if (!row) return notFound("Front not found.");
  const body = await readBody(request);
  if (!body) return badRequest("Invalid request body.");
  if (body.expectedVersion !== row.version) return stale();
  try {
    const [updated] = await db
      .update(fronts)
      .set({ ...frontFields(body), version: row.version + 1, updatedAt: new Date() })
      .where(and(eq(fronts.id, id), eq(fronts.version, row.version)))
      .returning();
    return updated ? NextResponse.json({ front: toClientFront(updated) }) : stale();
  } catch (error) {
    return calendarErrorResponse(error);
  }
}

/** Soft-deletes a front; its quests stay, no longer under a front. */
export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const row = await frontOf(await requireWorldId(), id);
  if (!row) return notFound("Front not found.");
  await db.transaction(async (tx) => {
    await tx.update(quests).set({ frontId: null, updatedAt: new Date() }).where(eq(quests.frontId, id));
    await tx.update(fronts).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(fronts.id, id));
  });
  return NextResponse.json({ ok: true });
}
