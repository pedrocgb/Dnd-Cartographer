import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { relations } from "@/server/db/schema";
import { relationInput, RelationError, saveRelation, softDeleteRelations } from "@/server/relations/store";

const EDITABLE = ["type", "label", "oneWay", "secret", "pinned", "attitude", "parentKind", "spouseStatus", "sinceDay", "untilDay", "notes"] as const;

/** Edits a relation (re-validated as a whole); `reverse: true` swaps its ends. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await db.query.relations.findFirst({ where: eq(relations.id, id) });
  if (!row || row.deletedAt) return NextResponse.json({ error: "Relation not found." }, { status: 404 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const merged = relationInput(row);
  for (const key of EDITABLE) if (key in body) merged[key] = body[key];
  if (body.reverse === true) [merged.fromId, merged.toId] = [row.toId, row.fromId];
  try {
    const relation = await saveRelation(row.worldId, merged, db, id);
    return NextResponse.json({ relation });
  } catch (err) {
    if (err instanceof RelationError) return NextResponse.json({ error: err.message }, { status: 409 });
    throw err;
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await softDeleteRelations([id]);
  return NextResponse.json({ ok: true });
}
