import { NextResponse } from "next/server";
import { eq, and, isNull, like } from "drizzle-orm";
import { db } from "@/server/db/client";
import { organizations } from "@/server/db/schema";
import { ensureDefaultWorld } from "@/server/world/default-world";
import { ORGANIZATION_KINDS } from "@/server/politics/hierarchy-config";

export async function GET(request: Request) {
  const worldId = await ensureDefaultWorld();
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
  if (!name) return NextResponse.json({ error: "A name is required." }, { status: 400 });

  const worldId = await ensureDefaultWorld();
  const kind = typeof body?.kind === "string" && (ORGANIZATION_KINDS as readonly string[]).includes(body.kind) ? body.kind : "House";
  const [created] = await db
    .insert(organizations)
    .values({ worldId, name, kind, description: typeof body?.description === "string" ? body.description : "" })
    .returning();
  return NextResponse.json({ organization: created }, { status: 201 });
}
