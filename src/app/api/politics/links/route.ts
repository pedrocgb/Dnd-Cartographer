import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/server/db/client";
import { politicalLinks } from "@/server/db/schema";
import { requireWorldId } from "@/server/world/active-world";
import { rowInWorld, type WorldTable } from "@/server/world/guards";

const OWNER_TYPES = ["marker", "territory", "person", "organization"] as const;
const TARGET_TYPES = ["map", "marker", "territory", "person", "organization"] as const;
const TABLE_OF = { map: "maps", marker: "markers", territory: "territories", person: "people", organization: "organizations" } as const satisfies Record<(typeof TARGET_TYPES)[number], WorldTable>;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ownerType = searchParams.get("ownerType");
  const ownerId = searchParams.get("ownerId");
  if (!ownerType || !ownerId) return NextResponse.json({ error: "ownerType and ownerId are required." }, { status: 400 });

  const rows = await db.query.politicalLinks.findMany({
    where: and(eq(politicalLinks.worldId, await requireWorldId()), eq(politicalLinks.ownerType, ownerType as (typeof OWNER_TYPES)[number]), eq(politicalLinks.ownerId, ownerId)),
  });
  return NextResponse.json({ links: rows });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const ownerType = body?.ownerType;
  const ownerId = typeof body?.ownerId === "string" ? body.ownerId : "";
  if (!(OWNER_TYPES as readonly string[]).includes(ownerType)) {
    return NextResponse.json({ error: `ownerType must be one of: ${OWNER_TYPES.join(", ")}.` }, { status: 400 });
  }
  if (!ownerId) return NextResponse.json({ error: "ownerId is required." }, { status: 400 });

  const externalUrl = typeof body?.externalUrl === "string" ? body.externalUrl.trim() : "";
  const targetType = body?.targetType;
  const targetId = typeof body?.targetId === "string" ? body.targetId : "";

  const isExternal = Boolean(externalUrl);
  const isInternal = (TARGET_TYPES as readonly string[]).includes(targetType) && Boolean(targetId);

  if (isExternal) {
    if (!/^https?:\/\//i.test(externalUrl)) {
      return NextResponse.json({ error: "External links must be http(s) URLs." }, { status: 400 });
    }
  } else if (!isInternal) {
    return NextResponse.json({ error: "Provide either an internal target (targetType + targetId) or an external http(s) URL." }, { status: 400 });
  }

  const worldId = await requireWorldId();
  if (!(await rowInWorld(TABLE_OF[ownerType as (typeof OWNER_TYPES)[number]], ownerId, worldId))) return NextResponse.json({ error: "The link's owner isn't in this world." }, { status: 404 });
  if (isInternal && !(await rowInWorld(TABLE_OF[targetType as (typeof TARGET_TYPES)[number]], targetId, worldId))) return NextResponse.json({ error: "The link's target isn't in this world." }, { status: 404 });
  const [created] = await db
    .insert(politicalLinks)
    .values({
      worldId,
      ownerType,
      ownerId,
      targetType: isInternal ? targetType : null,
      targetId: isInternal ? targetId : null,
      externalUrl: isExternal ? externalUrl : null,
      label: typeof body?.label === "string" ? body.label : "",
    })
    .returning();
  return NextResponse.json({ link: created }, { status: 201 });
}
