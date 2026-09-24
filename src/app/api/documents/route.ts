import { NextResponse } from "next/server";
import { ensureDefaultWorld } from "@/server/world/default-world";
import { createEmptyDocument } from "@/server/documents/create";

export async function POST() {
  const worldId = await ensureDefaultWorld();
  const doc = await createEmptyDocument(worldId);
  return NextResponse.json({ document: doc }, { status: 201 });
}
