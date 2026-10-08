import { NextResponse } from "next/server";
import { errorResponse, serverT } from "@/i18n/server";
import { requireWorldId } from "@/server/world/active-world";
import { campaignOf } from "@/server/sessions/store";
import { questsOf, toClientQuest } from "@/server/quests/store";
import { healthWarnings, readingOrder } from "@/server/writer/logic";
import { writerStateOf } from "@/server/writer/store";

type RouteContext = { params: Promise<{ id: string }> };

/** What the writer may have lost track of (threads, payoffs, MICE order, the Three Clue Rule). */
export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  if (!(await campaignOf(await requireWorldId(), id))) return errorResponse("campaignNotFound", 404);
  const [state, quests] = await Promise.all([writerStateOf(id), questsOf(id)]);
  const order = readingOrder(state.nodes).map((n) => n.id);
  return NextResponse.json({ warnings: healthWarnings(state.threads, state.beats, order, quests.map(toClientQuest), await serverT("writer")) });
}
