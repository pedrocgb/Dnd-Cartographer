import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { zones } from "@/server/db/schema";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [restored] = await db
    .update(zones)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(eq(zones.id, id))
    .returning();
  if (!restored) return NextResponse.json({ error: "Zone not found." }, { status: 404 });
  return NextResponse.json({ zone: restored });
}
