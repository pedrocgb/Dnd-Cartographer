import { NextResponse } from "next/server";
import { sanitizeInfo } from "@/server/articles/info-fields";
import { ORGANIZATION_INFO } from "@/server/articles/info-sets";
import { eq, and, isNull, like } from "drizzle-orm";
import { db } from "@/server/db/client";
import { organizations } from "@/server/db/schema";
import { requireWorldId } from "@/server/world/active-world";
import { ORGANIZATION_KINDS } from "@/server/politics/hierarchy-config";
import { errorResponse } from "@/i18n/server";

export async function GET(request: Request) {
  const worldId = await requireWorldId();
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const conditions = [eq(organizations.worldId, worldId), isNull(organizations.deletedAt)];
  if (q) conditions.push(like(organizations.name, `%${q}%`));
  const rows = await db.query.organizations.findMany({ where: and(...conditions) });
  return NextResponse.json({ organizations: rows });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return errorResponse("nameRequired", 400);

  const worldId = await requireWorldId();
  const kind = typeof body?.kind === "string" && (ORGANIZATION_KINDS as readonly string[]).includes(body.kind) ? body.kind : "Noble House";
  const [created] = await db
    .insert(organizations)
    .values({ worldId, name, kind, info: JSON.stringify(sanitizeInfo(ORGANIZATION_INFO, body?.info) ?? {}) })
    .returning();
  return NextResponse.json({ organization: created }, { status: 201 });
}
