import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { organizations } from "@/server/db/schema";
import { processPortraitUpload, deletePortraitFile, InvalidImageError } from "@/server/assets/portrait-upload";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const org = await db.query.organizations.findFirst({ where: eq(organizations.id, id) });
  if (!org) return NextResponse.json({ error: "Organization not found." }, { status: 404 });
  if (!request.body) return NextResponse.json({ error: "Empty upload." }, { status: 400 });

  let key: string;
  try {
    key = await processPortraitUpload("organization", id, request.body);
  } catch (err) {
    if (err instanceof InvalidImageError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }

  const [updated] = await db
    .update(organizations)
    .set({ portraitKey: key, updatedAt: new Date() })
    .where(eq(organizations.id, id))
    .returning();
  return NextResponse.json({ organization: updated });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const org = await db.query.organizations.findFirst({ where: eq(organizations.id, id) });
  if (!org) return NextResponse.json({ error: "Organization not found." }, { status: 404 });

  await deletePortraitFile("organization", id);
  const [updated] = await db
    .update(organizations)
    .set({ portraitKey: null, updatedAt: new Date() })
    .where(eq(organizations.id, id))
    .returning();
  return NextResponse.json({ organization: updated });
}
