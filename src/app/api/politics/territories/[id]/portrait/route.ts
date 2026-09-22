import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { territories } from "@/server/db/schema";
import { processPortraitUpload, deletePortraitFile, InvalidImageError } from "@/server/assets/portrait-upload";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const territory = await db.query.territories.findFirst({ where: eq(territories.id, id) });
  if (!territory) return NextResponse.json({ error: "Territory not found." }, { status: 404 });
  if (!request.body) return NextResponse.json({ error: "Empty upload." }, { status: 400 });

  let key: string;
  try {
    key = await processPortraitUpload("territory", id, request.body);
  } catch (err) {
    if (err instanceof InvalidImageError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }

  const [updated] = await db
    .update(territories)
    .set({ portraitKey: key, updatedAt: new Date() })
    .where(eq(territories.id, id))
    .returning();
  return NextResponse.json({ territory: updated });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const territory = await db.query.territories.findFirst({ where: eq(territories.id, id) });
  if (!territory) return NextResponse.json({ error: "Territory not found." }, { status: 404 });

  await deletePortraitFile("territory", id);
  const [updated] = await db
    .update(territories)
    .set({ portraitKey: null, updatedAt: new Date() })
    .where(eq(territories.id, id))
    .returning();
  return NextResponse.json({ territory: updated });
}
