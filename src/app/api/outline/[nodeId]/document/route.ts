import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { outlineNodes } from "@/server/db/schema";
import { requireWorldId } from "@/server/world/active-world";
import { createEmptyDocument } from "@/server/documents/create";
import { notFound } from "@/server/calendars/respond";
import { nodeOf, toClientNode } from "@/server/writer/store";

type RouteContext = { params: Promise<{ nodeId: string }> };

/** Gives an outline item its text document (once; a second call returns the same one). */
export async function POST(_request: Request, { params }: RouteContext) {
  const { nodeId } = await params;
  const worldId = await requireWorldId();
  const row = await nodeOf(worldId, nodeId);
  if (!row) return notFound("Outline item not found.");
  if (row.documentId) return NextResponse.json({ node: toClientNode(row) });
  const doc = await createEmptyDocument(worldId);
  // Only if still without one: two tabs opening it at once share the first document.
  await db.update(outlineNodes).set({ documentId: doc.id }).where(and(eq(outlineNodes.id, nodeId), isNull(outlineNodes.documentId)));
  return NextResponse.json({ node: toClientNode((await nodeOf(worldId, nodeId))!) });
}
