import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { politicalReferences } from "@/server/db/schema";

export async function DELETE(_request: Request, { params }: { params: Promise<{ markerId: string; refId: string }> }) {
  const { refId } = await params;
  await db.delete(politicalReferences).where(eq(politicalReferences.id, refId));
  return NextResponse.json({ ok: true });
}
