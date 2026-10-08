import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { definitionRevisions } from "@/server/db/schema";
import { requireWorldId } from "@/server/world/active-world";
import { errorResponse } from "@/i18n/server";

/** Saved revisions of a celestial object or season profile (`subjectType`, `subjectId`), newest first. Calendars have their own route. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const subjectType = url.searchParams.get("subjectType");
  const subjectId = url.searchParams.get("subjectId");
  if ((subjectType !== "celestial" && subjectType !== "profile") || !subjectId) return errorResponse("revisionSubjectMissing", 400);
  const worldId = await requireWorldId();
  const rows = await db
    .select({ id: definitionRevisions.id, version: definitionRevisions.version, reason: definitionRevisions.reason, createdAt: definitionRevisions.createdAt })
    .from(definitionRevisions)
    .where(and(eq(definitionRevisions.worldId, worldId), eq(definitionRevisions.subjectType, subjectType), eq(definitionRevisions.subjectId, subjectId)))
    .orderBy(desc(definitionRevisions.createdAt))
    .limit(50);
  return NextResponse.json({ revisions: rows });
}
