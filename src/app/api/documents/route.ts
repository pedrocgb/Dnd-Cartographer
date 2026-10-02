import { NextResponse } from "next/server";
import { requireWorldId } from "@/server/world/active-world";
import { createEmptyDocument } from "@/server/documents/create";

export async function POST() {
  const worldId = await requireWorldId();
  const doc = await createEmptyDocument(worldId);
  return NextResponse.json({ document: doc }, { status: 201 });
}
