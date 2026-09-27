import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { campaignCharacters } from "@/server/db/schema";
import { ensureDefaultWorld } from "@/server/world/default-world";
import { badRequest, notFound, readBody } from "@/server/calendars/respond";
import { campaignOf, rosterOf, sessionsOf, sessionsUsingPerson } from "@/server/sessions/store";

type RouteContext = { params: Promise<{ id: string; charId: string }> };

async function memberOf(campaignId: string, charId: string) {
  const [row] = await db.select().from(campaignCharacters).where(and(eq(campaignCharacters.id, charId), eq(campaignCharacters.campaignId, campaignId)));
  return row ?? null;
}

const STATUSES = ["active", "retired", "dead"] as const;

/** Edits a party member's player name or status (active / retired / dead). */
export async function PATCH(request: Request, { params }: RouteContext) {
  const { id, charId } = await params;
  const worldId = await ensureDefaultWorld();
  if (!(await campaignOf(worldId, id))) return notFound("Campaign not found.");
  if (!(await memberOf(id, charId))) return notFound("Party member not found.");
  const body = await readBody(request);
  if (!body) return badRequest("Invalid request body.");
  const patch: Partial<typeof campaignCharacters.$inferInsert> = { updatedAt: new Date() };
  if ("status" in body) {
    if (!STATUSES.includes(body.status as (typeof STATUSES)[number])) return badRequest("Status must be active, retired or dead.");
    patch.status = body.status as (typeof STATUSES)[number];
  }
  await db.update(campaignCharacters).set(patch).where(eq(campaignCharacters.id, charId));
  return NextResponse.json({ roster: await rosterOf(id) });
}

/** Removes a party member who never played or received anything; otherwise retire them instead. */
export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id, charId } = await params;
  const worldId = await ensureDefaultWorld();
  if (!(await campaignOf(worldId, id))) return notFound("Campaign not found.");
  const member = await memberOf(id, charId);
  if (!member) return notFound("Party member not found.");
  const used = sessionsUsingPerson(await sessionsOf(id), member.personId);
  if (used.length) return NextResponse.json({ error: `They played or received something in session ${used.map((s) => s.number).join(", ")}. Mark them retired instead.` }, { status: 409 });
  await db.delete(campaignCharacters).where(eq(campaignCharacters.id, charId));
  return NextResponse.json({ roster: await rosterOf(id) });
}
