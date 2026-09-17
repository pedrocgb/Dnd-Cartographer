import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/server/db/client";
import { markers, territories, markerAffiliations } from "@/server/db/schema";
import { resolveChain, levelsByProfileId, toTerritoryLike, getAuthoritiesForChain, getAcceptedAffiliation, getDraftAffiliation } from "@/server/politics/queries";
import { validateChain, computeMissingRequiredTypes, isAttachableType } from "@/server/politics/hierarchy-config";

async function describeAffiliation(territoryId: string) {
  const chain = await resolveChain(territoryId);
  const levelsMap = await levelsByProfileId(chain.map((t) => t.hierarchyProfileId));
  const missingRequiredTypes = computeMissingRequiredTypes(toTerritoryLike(chain), levelsMap);
  const authorities = await getAuthoritiesForChain(chain.map((t) => t.id));
  return { chain, missingRequiredTypes, authorities };
}

export async function GET(_request: Request, { params }: { params: Promise<{ markerId: string }> }) {
  const { markerId } = await params;
  const [accepted, draft] = await Promise.all([getAcceptedAffiliation(markerId), getDraftAffiliation(markerId)]);

  const acceptedDetail = accepted ? await describeAffiliation(accepted.territoryId) : null;
  const draftDetail = draft ? await describeAffiliation(draft.territoryId) : null;

  return NextResponse.json({
    accepted: accepted ? { ...accepted, ...acceptedDetail } : null,
    draft: draft ? { ...draft, ...draftDetail } : null,
  });
}

export async function PUT(request: Request, { params }: { params: Promise<{ markerId: string }> }) {
  const { markerId } = await params;
  const marker = await db.query.markers.findFirst({ where: eq(markers.id, markerId) });
  if (!marker) return NextResponse.json({ error: "Marker not found." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const territoryId = typeof body?.territoryId === "string" ? body.territoryId : "";
  const status = body?.status === "accepted" || body?.status === "draft" ? body.status : null;
  if (!territoryId) return NextResponse.json({ error: "territoryId is required." }, { status: 400 });
  if (!status) return NextResponse.json({ error: "status must be 'accepted' or 'draft'." }, { status: 400 });

  const territory = await db.query.territories.findFirst({ where: eq(territories.id, territoryId) });
  if (!territory) return NextResponse.json({ error: "Territory not found." }, { status: 404 });

  const chain = await resolveChain(territoryId);
  const levelsMap = await levelsByProfileId(chain.map((t) => t.hierarchyProfileId));
  const chainResult = validateChain(toTerritoryLike(chain), levelsMap);
  if (!chainResult.valid) return NextResponse.json({ error: chainResult.error }, { status: 400 });

  if (status === "accepted") {
    const leafLevels = levelsMap.get(territory.hierarchyProfileId) ?? [];
    if (!isAttachableType(territory.type, leafLevels)) {
      return NextResponse.json({ error: `Markers cannot attach directly to a territory of type "${territory.type}".` }, { status: 400 });
    }
    const missing = computeMissingRequiredTypes(toTerritoryLike(chain), levelsMap);
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Affiliation is incomplete — missing required level(s): ${missing.join(", ")}. Save it as a draft instead, or complete the chain.` },
        { status: 400 }
      );
    }
  }

  const existing = await db.query.markerAffiliations.findFirst({
    where: and(eq(markerAffiliations.markerId, markerId), eq(markerAffiliations.status, status)),
  });
  if (existing) {
    await db.update(markerAffiliations).set({ territoryId, updatedAt: new Date() }).where(eq(markerAffiliations.id, existing.id));
  } else {
    await db.insert(markerAffiliations).values({ markerId, territoryId, status });
  }

  // Committing a complete accepted affiliation supersedes any in-progress
  // draft proposing the same completion — keeping a stale draft around
  // after acceptance would just be confusing, not a second source of truth.
  if (status === "accepted") {
    const draft = await getDraftAffiliation(markerId);
    if (draft) await db.delete(markerAffiliations).where(eq(markerAffiliations.id, draft.id));
  }

  const detail = await describeAffiliation(territoryId);
  return NextResponse.json({ status, territoryId, ...detail });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ markerId: string }> }) {
  const { markerId } = await params;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") === "draft" ? "draft" : "accepted";
  await db.delete(markerAffiliations).where(and(eq(markerAffiliations.markerId, markerId), eq(markerAffiliations.status, status)));
  return NextResponse.json({ ok: true });
}
