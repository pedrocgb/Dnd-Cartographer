import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { politicalLinks } from "@/server/db/schema";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.delete(politicalLinks).where(eq(politicalLinks.id, id));
  return NextResponse.json({ ok: true });
}
