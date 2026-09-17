import { NextResponse } from "next/server";
import { eq, and, isNull, like } from "drizzle-orm";
import { db } from "@/server/db/client";
import { territories, hierarchyProfiles } from "@/server/db/schema";
import { ensureDefaultWorld } from "@/server/world/default-world";
import { ensureDefaultHierarchyProfile } from "@/server/politics/seed";
import { resolveChain, levelsByProfileId, toTerritoryLike } from "@/server/politics/queries";
import { validateChain } from "@/server/politics/hierarchy-config";

export async function GET(request: Request) {
  const worldId = await ensureDefaultWorld();
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const parentId = searchParams.get("parentId");

  const conditions = [eq(territories.worldId, worldId), isNull(territories.deletedAt)];
  if (q) conditions.push(like(territories.name, `%${q}%`));
  if (parentId !== null) conditions.push(parentId === "" ? isNull(territories.parentId) : eq(territories.parentId, parentId));

  const rows = await db.query.territories.findMany({ where: and(...conditions) });
  return NextResponse.json({ territories: rows });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const type = typeof body?.type === "string" ? body.type.trim() : "";
  if (!name) return NextResponse.json({ error: "A territory name is required." }, { status: 400 });
  if (!type) return NextResponse.json({ error: "A territory type is required." }, { status: 400 });

  const worldId = await ensureDefaultWorld();
  const parentId = typeof body?.parentId === "string" && body.parentId ? body.parentId : null;

  let parent = null;
  if (parentId) {
    parent = await db.query.territories.findFirst({ where: eq(territories.id, parentId) });
    if (!parent || parent.worldId !== worldId) {
      return NextResponse.json({ error: "Parent territory not found in this world." }, { status: 400 });
    }
  }

  // A new child defaults to inheriting its parent's profile (the common
  // case — subdivisions of a realm usually follow that realm's own rules)
  // but may be given an explicit different one, e.g. a subordinate kingdom
  // configuring its own internal profile.
  const hierarchyProfileId =
    typeof body?.hierarchyProfileId === "string" && body.hierarchyProfileId
      ? body.hierarchyProfileId
      : (parent?.hierarchyProfileId ?? (await ensureDefaultHierarchyProfile(worldId)));

  const profile = await db.query.hierarchyProfiles.findFirst({ where: eq(hierarchyProfiles.id, hierarchyProfileId) });
  if (!profile || profile.worldId !== worldId) {
    return NextResponse.json({ error: "Hierarchy profile not found in this world." }, { status: 400 });
  }

  const candidate = { id: "candidate", type, parentId, hierarchyProfileId };
  const ancestors = parentId ? toTerritoryLike(await resolveChain(parentId)) : [];
  const chain = [...ancestors, candidate];
  const levelsMap = await levelsByProfileId(chain.map((t) => t.hierarchyProfileId));
  const result = validateChain(chain, levelsMap);
  if (!result.valid) return NextResponse.json({ error: result.error }, { status: 400 });

  const [created] = await db
    .insert(territories)
    .values({
      worldId,
      name,
      type,
      description: typeof body?.description === "string" ? body.description : "",
      parentId,
      hierarchyProfileId,
      governmentForm: typeof body?.governmentForm === "string" ? body.governmentForm : null,
      powerHolders: typeof body?.powerHolders === "string" ? body.powerHolders : null,
      leadershipSelection: typeof body?.leadershipSelection === "string" ? body.leadershipSelection : null,
      autonomy: typeof body?.autonomy === "string" ? body.autonomy : null,
      situation: typeof body?.situation === "string" ? body.situation : null,
    })
    .returning();
  return NextResponse.json({ territory: created }, { status: 201 });
}
