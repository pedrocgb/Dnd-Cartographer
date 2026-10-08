import { NextResponse } from "next/server";
import { errorResponse } from "@/i18n/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { relationshipBoards } from "@/server/db/schema";
import { requireWorldId } from "@/server/world/active-world";
import { sanitizeBoardCards, sanitizeBoardFilters, sanitizeBoardName, toClientBoard } from "@/server/relations/board-store";

type RouteContext = { params: Promise<{ id: string }> };

async function boardOf(id: string) {
  const worldId = await requireWorldId();
  return db.query.relationshipBoards.findFirst({
    where: and(eq(relationshipBoards.id, id), eq(relationshipBoards.worldId, worldId), isNull(relationshipBoards.deletedAt)),
  });
}

const notFound = () => errorResponse("boardNotFound", 404);

/** Renames a board or replaces its cards / filters (each optional). */
export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  if (!(await boardOf(id))) return notFound();
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return errorResponse("invalidBody", 400);
  const patch: Partial<typeof relationshipBoards.$inferInsert> = { updatedAt: new Date() };
  if ("name" in body) {
    const name = sanitizeBoardName(body.name);
    if (!name) return errorResponse("boardNameRequired", 400);
    patch.name = name;
  }
  if ("cards" in body) {
    const cards = sanitizeBoardCards(body.cards);
    if (!cards) return NextResponse.json({ error: "Cards must be a list." }, { status: 400 });
    patch.cards = JSON.stringify(cards);
  }
  if ("filters" in body) {
    const filters = sanitizeBoardFilters(body.filters);
    if (!filters) return NextResponse.json({ error: "Filters must be an object." }, { status: 400 });
    patch.filters = JSON.stringify(filters);
  }
  const [row] = await db.update(relationshipBoards).set(patch).where(eq(relationshipBoards.id, id)).returning();
  return NextResponse.json({ board: toClientBoard(row) });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  if (!(await boardOf(id))) return notFound();
  await db.update(relationshipBoards).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(relationshipBoards.id, id));
  return NextResponse.json({ ok: true });
}
