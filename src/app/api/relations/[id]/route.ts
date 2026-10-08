import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { relations } from "@/server/db/schema";
import { relationInput, RelationError, saveRelation, softDeleteRelations } from "@/server/relations/store";
import { relationErrorResponse } from "@/server/relations/respond";
import { notInWorld } from "@/server/world/guards";
import { errorResponse } from "@/i18n/server";

const EDITABLE = ["type", "label", "oneWay", "secret", "pinned", "attitude", "parentKind", "spouseStatus", "sinceDay", "untilDay", "notes"] as const;

/** Edits a relation (re-validated as a whole); `reverse: true` swaps its ends. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const denied = await notInWorld("relations", id, "relationNotFound");
  if (denied) return denied;
  const row = await db.query.relations.findFirst({ where: eq(relations.id, id) });
  if (!row || row.deletedAt) return errorResponse("relationNotFound", 404);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return errorResponse("invalidBody", 400);

  const merged = relationInput(row);
  for (const key of EDITABLE) if (key in body) merged[key] = body[key];
  if (body.reverse === true) [merged.fromId, merged.toId] = [row.toId, row.fromId];
  try {
    const relation = await saveRelation(row.worldId, merged, db, id);
    return NextResponse.json({ relation });
  } catch (err) {
    if (err instanceof RelationError) return relationErrorResponse(err);
    throw err;
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const denied = await notInWorld("relations", id, "relationNotFound");
  if (denied) return denied;
  await softDeleteRelations([id]);
  return NextResponse.json({ ok: true });
}
