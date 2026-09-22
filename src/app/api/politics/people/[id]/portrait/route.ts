import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { people } from "@/server/db/schema";
import { processPortraitUpload, deletePortraitFile, InvalidImageError } from "@/server/assets/portrait-upload";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const person = await db.query.people.findFirst({ where: eq(people.id, id) });
  if (!person) return NextResponse.json({ error: "Person not found." }, { status: 404 });
  if (!request.body) return NextResponse.json({ error: "Empty upload." }, { status: 400 });

  let key: string;
  try {
    key = await processPortraitUpload("person", id, request.body);
  } catch (err) {
    if (err instanceof InvalidImageError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }

  const [updated] = await db
    .update(people)
    .set({ portraitKey: key, updatedAt: new Date() })
    .where(eq(people.id, id))
    .returning();
  return NextResponse.json({ person: updated });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const person = await db.query.people.findFirst({ where: eq(people.id, id) });
  if (!person) return NextResponse.json({ error: "Person not found." }, { status: 404 });

  await deletePortraitFile("person", id);
  const [updated] = await db
    .update(people)
    .set({ portraitKey: null, updatedAt: new Date() })
    .where(eq(people.id, id))
    .returning();
  return NextResponse.json({ person: updated });
}
