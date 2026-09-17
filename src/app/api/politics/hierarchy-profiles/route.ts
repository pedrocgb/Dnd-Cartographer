import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { hierarchyProfiles } from "@/server/db/schema";
import { ensureDefaultWorld } from "@/server/world/default-world";
import { ensureDefaultHierarchyProfile } from "@/server/politics/seed";
import { encodeHierarchyLevels, parseHierarchyLevels, type HierarchyLevel } from "@/server/politics/hierarchy-config";

function serialize(row: typeof hierarchyProfiles.$inferSelect) {
  return { ...row, levels: parseHierarchyLevels(row.levels) };
}

export async function GET() {
  const worldId = await ensureDefaultWorld();
  await ensureDefaultHierarchyProfile(worldId);
  const rows = await db.query.hierarchyProfiles.findMany({ where: eq(hierarchyProfiles.worldId, worldId) });
  return NextResponse.json({ profiles: rows.map(serialize) });
}

function isValidLevels(value: unknown): value is HierarchyLevel[] {
  return (
    Array.isArray(value) &&
    value.every(
      (l) =>
        l &&
        typeof l.type === "string" &&
        l.type.trim() &&
        typeof l.canBeRoot === "boolean" &&
        typeof l.required === "boolean" &&
        typeof l.attachable === "boolean" &&
        Array.isArray(l.allowedParentTypes) &&
        l.allowedParentTypes.every((p: unknown) => typeof p === "string")
    )
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "A profile name is required." }, { status: 400 });
  if (!isValidLevels(body?.levels)) {
    return NextResponse.json({ error: "levels must be an array of valid HierarchyLevel objects." }, { status: 400 });
  }

  const worldId = await ensureDefaultWorld();
  const [created] = await db
    .insert(hierarchyProfiles)
    .values({
      worldId,
      name,
      description: typeof body?.description === "string" ? body.description : "",
      levels: encodeHierarchyLevels(body.levels),
    })
    .returning();
  return NextResponse.json({ profile: serialize(created) }, { status: 201 });
}
