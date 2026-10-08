import { NextResponse } from "next/server";
import { requireWorldId } from "@/server/world/active-world";
import { listRelations, RelationError, saveRelation, serverDerivedEdges } from "@/server/relations/store";
import { relationErrorResponse } from "@/server/relations/respond";
import { errorResponse, serverLocale } from "@/i18n/server";

/** The world's live relations, plus the read-only edges computed from rulers and seats. */
export async function GET() {
  const worldId = await requireWorldId();
  const [relations, derived] = await Promise.all([listRelations(worldId), serverDerivedEdges(worldId, await serverLocale())]);
  return NextResponse.json({ relations, derived });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return errorResponse("invalidBody", 400);
  const worldId = await requireWorldId();
  try {
    const relation = await saveRelation(worldId, body);
    return NextResponse.json({ relation }, { status: 201 });
  } catch (err) {
    if (err instanceof RelationError) return relationErrorResponse(err);
    throw err;
  }
}
