import { NextResponse } from "next/server";
import { errorResponse } from "@/i18n/server";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { relationshipBoards } from "@/server/db/schema";
import { requireWorldId } from "@/server/world/active-world";
import { sanitizeBoardName, toClientBoard } from "@/server/relations/board-store";

export async function GET() {
  const worldId = await requireWorldId();
  const rows = await db
    .select()
    .from(relationshipBoards)
    .where(and(eq(relationshipBoards.worldId, worldId), isNull(relationshipBoards.deletedAt)))
    .orderBy(asc(relationshipBoards.name));
  return NextResponse.json({ boards: rows.map(toClientBoard) });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = sanitizeBoardName(body?.name);
  if (!name) return errorResponse("boardNameRequired", 400);
  const worldId = await requireWorldId();
  const [row] = await db.insert(relationshipBoards).values({ worldId, name }).returning();
  return NextResponse.json({ board: toClientBoard(row) }, { status: 201 });
}
