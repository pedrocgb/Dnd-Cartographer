import { NextResponse } from "next/server";
import { ensureDefaultWorld } from "@/server/world/default-world";
import { listRelations, RelationError, saveRelation, serverDerivedEdges } from "@/server/relations/store";

/** The world's live relations, plus the read-only edges computed from rulers and seats. */
export async function GET() {
  const worldId = await ensureDefaultWorld();
  const [relations, derived] = await Promise.all([listRelations(worldId), serverDerivedEdges(worldId)]);
  return NextResponse.json({ relations, derived });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  const worldId = await ensureDefaultWorld();
  try {
    const relation = await saveRelation(worldId, body);
    return NextResponse.json({ relation }, { status: 201 });
  } catch (err) {
    if (err instanceof RelationError) return NextResponse.json({ error: err.message }, { status: 409 });
    throw err;
  }
}
