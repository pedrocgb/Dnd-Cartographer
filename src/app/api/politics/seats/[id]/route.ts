import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { territorySeats } from "@/server/db/schema";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.delete(territorySeats).where(eq(territorySeats.id, id));
  return NextResponse.json({ ok: true });
}
