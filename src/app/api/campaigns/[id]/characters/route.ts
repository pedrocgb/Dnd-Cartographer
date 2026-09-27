import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { campaignCharacters, people } from "@/server/db/schema";
import { ensureDefaultWorld } from "@/server/world/default-world";
import { badRequest, notFound, readBody } from "@/server/calendars/respond";
import { campaignOf, rosterOf } from "@/server/sessions/store";

type RouteContext = { params: Promise<{ id: string }> };

/** Adds a player character (a live Player Character article) to the campaign's party. Its player is read from the article. */
export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const worldId = await ensureDefaultWorld();
  if (!(await campaignOf(worldId, id))) return notFound("Campaign not found.");
  const body = await readBody(request);
  if (!body) return badRequest("Invalid request body.");
  if (typeof body.personId !== "string" || !body.personId) return badRequest("Pick a player character.");
  const [person] = await db.select({ id: people.id, kind: people.kind }).from(people).where(and(eq(people.id, body.personId), eq(people.worldId, worldId), isNull(people.deletedAt)));
  if (!person) return badRequest("That character doesn't exist (it may have been deleted).");
  if (person.kind !== "player") return badRequest("Only Player Character articles can join the party.");
  const roster = await rosterOf(id);
  if (roster.some((m) => m.personId === person.id)) return NextResponse.json({ error: "That character is already in the party." }, { status: 409 });
  await db.insert(campaignCharacters).values({ campaignId: id, personId: person.id, sortOrder: roster.length });
  return NextResponse.json({ roster: await rosterOf(id) }, { status: 201 });
}
