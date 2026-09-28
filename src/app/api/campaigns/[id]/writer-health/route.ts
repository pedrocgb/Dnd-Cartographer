import { NextResponse } from "next/server";
import { ensureDefaultWorld } from "@/server/world/default-world";
import { notFound } from "@/server/calendars/respond";
import { campaignOf } from "@/server/sessions/store";
import { questsOf, toClientQuest } from "@/server/quests/store";
import { healthWarnings, readingOrder } from "@/server/writer/logic";
import { writerStateOf } from "@/server/writer/store";

type RouteContext = { params: Promise<{ id: string }> };

/** What the writer may have lost track of (threads, payoffs, MICE order, the Three Clue Rule). */
export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  if (!(await campaignOf(await ensureDefaultWorld(), id))) return notFound("Campaign not found.");
  const [state, quests] = await Promise.all([writerStateOf(id), questsOf(id)]);
  const order = readingOrder(state.nodes).map((n) => n.id);
  return NextResponse.json({ warnings: healthWarnings(state.threads, state.beats, order, quests.map(toClientQuest)) });
}
