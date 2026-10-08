import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { mapCategories } from "@/server/db/schema";
import { requireWorldId } from "@/server/world/active-world";
import { ensureSeededCategories } from "@/server/maps/seed-categories";
import { errorResponse } from "@/i18n/server";

export async function GET() {
  const worldId = await requireWorldId();
  await ensureSeededCategories(worldId);
  const categories = await db
    .select()
    .from(mapCategories)
    .where(eq(mapCategories.worldId, worldId))
    .orderBy(mapCategories.sortOrder);
  return NextResponse.json({ categories });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const label = typeof body?.label === "string" ? body.label.trim() : "";
  if (!label) {
    return errorResponse("categoryLabelRequired", 400);
  }

  const worldId = await requireWorldId();
  const [category] = await db
    .insert(mapCategories)
    .values({ worldId, label, sortOrder: 1000 })
    .returning();
  return NextResponse.json({ category }, { status: 201 });
}
