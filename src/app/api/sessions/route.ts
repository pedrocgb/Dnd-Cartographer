import { NextResponse } from "next/server";
import { and, asc, eq, gte, isNull, like, lte, or } from "drizzle-orm";
import { db } from "@/server/db/client";
import { campaigns, sessions } from "@/server/db/schema";
import { requireWorldId } from "@/server/world/active-world";
import { cleanName } from "@/server/calendars/parse";
import { badRequest, notFound, readBody } from "@/server/calendars/respond";
import { campaignOf, createNextSession, sessionsOf, toClientSession, type SessionRow } from "@/server/sessions/store";

/** Widest in-world window one request may ask for, like calendar entries. */
const MAX_WINDOW = 50_000;

/** A session as a calendar/backlink row: enough to label and link it. */
const brief = (row: SessionRow, campaignName: string) => ({ id: row.id, campaignId: row.campaignId, campaignName, number: row.number, title: row.title, startDay: row.startDay, endDay: row.endDay });

/**
 * `campaignId`: that campaign's live sessions (full). `from`/`to`: sessions
 * whose in-world span overlaps the range. `articleId`: sessions linking the
 * article, attended by it (a PC) or giving it as loot (capped at 200).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const worldId = await requireWorldId();
  const campaignId = url.searchParams.get("campaignId");
  if (campaignId) {
    if (!(await campaignOf(worldId, campaignId))) return notFound("Campaign not found.");
    return NextResponse.json({ sessions: await sessionsOf(campaignId) });
  }
  const live = and(eq(sessions.worldId, worldId), isNull(sessions.deletedAt), isNull(campaigns.archivedAt));
  const select = () => db.select({ row: sessions, campaignName: campaigns.name }).from(sessions).innerJoin(campaigns, eq(campaigns.id, sessions.campaignId));
  const articleId = url.searchParams.get("articleId");
  if (articleId) {
    const id = articleId.replace(/[%_"]/g, "").slice(0, 64);
    const rows = await select()
      .where(and(live, or(like(sessions.articleLinks, `%"articleId":"${id}"%`), like(sessions.attendance, `%"${id}"%`), like(sessions.loot, `%"articleId":"${id}"%`))))
      .orderBy(asc(sessions.startDay), asc(sessions.number))
      .limit(200);
    return NextResponse.json({ sessions: rows.map((r) => brief(r.row, r.campaignName)) });
  }
  const from = Number(url.searchParams.get("from"));
  const to = Number(url.searchParams.get("to"));
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || to < from) return badRequest("Pass a campaignId, an articleId, or a from/to day range.");
  if (to - from > MAX_WINDOW) return badRequest(`Ask for at most ${MAX_WINDOW} days at once.`);
  const rows = await select()
    .where(and(live, lte(sessions.startDay, to), gte(sessions.endDay, from)))
    .orderBy(asc(sessions.startDay), asc(sessions.number));
  return NextResponse.json({ sessions: rows.map((r) => brief(r.row, r.campaignName)) });
}

/** Creates the campaign's next session (see createNextSession). */
export async function POST(request: Request) {
  const body = await readBody(request);
  if (!body) return badRequest("Invalid request body.");
  if (typeof body.campaignId !== "string") return badRequest("Pick the campaign.");
  const worldId = await requireWorldId();
  const campaign = await campaignOf(worldId, body.campaignId);
  if (!campaign) return notFound("Campaign not found.");
  const row = await createNextSession(worldId, campaign.id, cleanName(body.title, 120));
  return NextResponse.json({ session: toClientSession(row) }, { status: 201 });
}
