import { NextResponse } from "next/server";
import { errorResponse } from "@/i18n/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { campaignCharacters, people } from "@/server/db/schema";
import { requireWorldId } from "@/server/world/active-world";
import { readBody } from "@/server/calendars/respond";
import { campaignOf, rosterOf } from "@/server/sessions/store";

type RouteContext = { params: Promise<{ id: string }> };

/** Adds a player character (a live Player Character article) to the campaign's party. Its player is read from the article. */
export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const worldId = await requireWorldId();
  if (!(await campaignOf(worldId, id))) return errorResponse("campaignNotFound", 404);
  const body = await readBody(request);
  if (!body) return errorResponse("invalidBody", 400);
  if (typeof body.personId !== "string" || !body.personId) return errorResponse("partyPickCharacter", 400);
  const [person] = await db.select({ id: people.id, kind: people.kind }).from(people).where(and(eq(people.id, body.personId), eq(people.worldId, worldId), isNull(people.deletedAt)));
  if (!person) return errorResponse("partyCharacterMissing", 400);
  if (person.kind !== "player") return errorResponse("partyPlayersOnly", 400);
  const roster = await rosterOf(id);
  if (roster.some((m) => m.personId === person.id)) return errorResponse("partyAlreadyIn", 409);
  await db.insert(campaignCharacters).values({ campaignId: id, personId: person.id, sortOrder: roster.length });
  return NextResponse.json({ roster: await rosterOf(id) }, { status: 201 });
}
