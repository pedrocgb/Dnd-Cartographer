import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { relations } from "@/server/db/schema";
import { relationInput, RelationError, saveRelation } from "@/server/relations/store";
import { notInWorld } from "@/server/world/guards";

/** Undoes a delete, unless an equal relation was added since (or the tie is no longer allowed). */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const denied = await notInWorld("relations", id, "Relation not found.");
  if (denied) return denied;
  const row = await db.query.relations.findFirst({ where: eq(relations.id, id) });
  if (!row) return NextResponse.json({ error: "Relation not found." }, { status: 404 });
  if (!row.deletedAt) return NextResponse.json({ relation: row });
  try {
    // Re-validated as an edit of this row, then brought back.
    await saveRelation(row.worldId, relationInput(row), db, id);
    const [relation] = await db.update(relations).set({ deletedAt: null, updatedAt: new Date() }).where(eq(relations.id, id)).returning();
    return NextResponse.json({ relation });
  } catch (err) {
    if (err instanceof RelationError) return NextResponse.json({ error: err.message }, { status: 409 });
    throw err;
  }
}
