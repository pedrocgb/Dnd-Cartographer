import { NextResponse } from "next/server";
import { and, asc, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { campaignStatusLog, outlineNodes, sessions } from "@/server/db/schema";
import { requireWorldId } from "@/server/world/active-world";
import { checkArticles } from "@/server/calendars/entries";
import { safeJson } from "@/server/calendars/parse";
import { badRequest, calendarErrorResponse, notFound, readBody } from "@/server/calendars/respond";
import { campaignOf, createNextSession, sessionOf, toClientSession } from "@/server/sessions/store";
import { carrySecrets, reviewScene } from "@/server/writer/logic";
import { parseReview, readPrep } from "@/server/writer/parse";
import { nodesOf, toClientNode } from "@/server/writer/store";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * "What happened?" after a session: each planned scene is played, changed,
 * not reached (moves to the next session) or cut; secrets are revealed or
 * carried to the next session; world changes go to the status log. Creates
 * the next session when something carries forward and there isn't one yet.
 */
export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const worldId = await requireWorldId();
  const session = await sessionOf(worldId, id);
  if (!session) return notFound("Session not found.");
  const campaign = await campaignOf(worldId, session.campaignId);
  if (!campaign) return notFound("Campaign not found.");
  const body = await readBody(request);
  if (!body) return badRequest("Invalid request body.");
  try {
    const review = parseReview(body);
    await checkArticles(worldId, review.entries.flatMap((e) => (e.subject ? [e.subject] : [])));
    const nodes = await nodesOf(campaign.id);
    const scenes = review.scenes.map((r) => ({ r, node: nodes.find((n) => n.id === r.id && n.kind === "scene") }));
    if (scenes.some((s) => !s.node)) return badRequest("A reviewed scene isn't in this campaign's outline.");

    const prep = readPrep(safeJson<unknown>(session.prep, {}));
    const carriesSecrets = prep.secrets.some((s) => s.state !== "revealed" && !review.secrets[s.id]);
    const carriesScenes = review.scenes.some((s) => s.outcome === "later");
    const [existingNext] = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.campaignId, campaign.id), gt(sessions.number, session.number), isNull(sessions.deletedAt)))
      .orderBy(asc(sessions.number))
      .limit(1);
    const next = existingNext ?? (carriesSecrets || carriesScenes ? await createNextSession(worldId, campaign.id) : null);
    const nextPrep = next ? readPrep(safeJson<unknown>(next.prep, {})) : null;
    const { reviewed, carried } = carrySecrets(prep.secrets, review.secrets, nextPrep?.secrets ?? []);

    await db.transaction(async (tx) => {
      for (const { r, node } of scenes) {
        const patch = reviewScene(node!, r.outcome, r.changeNote, id, next?.id ?? null);
        await tx
          .update(outlineNodes)
          .set({ ...patch, version: node!.version + 1, updatedAt: new Date() })
          .where(eq(outlineNodes.id, node!.id));
      }
      await tx
        .update(sessions)
        .set({ prep: JSON.stringify({ ...prep, secrets: reviewed, reviewed: true }), version: session.version + 1, updatedAt: new Date() })
        .where(eq(sessions.id, id));
      if (next && nextPrep && carried.length) {
        await tx
          .update(sessions)
          .set({ prep: JSON.stringify({ ...nextPrep, secrets: [...nextPrep.secrets, ...carried] }), version: next.version + 1, updatedAt: new Date() })
          .where(eq(sessions.id, next.id));
      }
      if (review.entries.length) {
        await tx.insert(campaignStatusLog).values(
          review.entries.map((e) => ({ worldId, campaignId: campaign.id, sessionId: id, worldDay: session.endDay ?? session.startDay, kind: e.kind, subject: e.subject ? JSON.stringify(e.subject) : null, text: e.text }))
        );
      }
    });

    const sessionIds = [id, ...(next ? [next.id] : [])];
    const updated = await Promise.all(sessionIds.map((sid) => sessionOf(worldId, sid)));
    return NextResponse.json({
      sessions: updated.flatMap((s) => (s ? [toClientSession(s)] : [])),
      nodes: (await nodesOf(campaign.id)).map(toClientNode),
      createdNext: !existingNext && next !== null,
    });
  } catch (error) {
    return calendarErrorResponse(error);
  }
}
