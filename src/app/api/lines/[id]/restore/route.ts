import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { mapLines } from "@/server/db/schema";
import { toClientLine } from "@/server/lines/line-config";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [restored] = await db.update(mapLines).set({ deletedAt: null, updatedAt: new Date() }).where(eq(mapLines.id, id)).returning();
  if (!restored) return NextResponse.json({ error: "Line not found." }, { status: 404 });
  return NextResponse.json({ line: toClientLine(restored) });
}
