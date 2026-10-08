import { NextResponse } from "next/server";
import { errorResponse } from "@/i18n/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { markerArticleLinks } from "@/server/db/schema";
import { removeLink, setPrimaryLink } from "@/server/markers/article-links";
import { notInWorld } from "@/server/world/guards";

const MAX_LABEL_LENGTH = 80;

/** Changes a link's relationship label, or makes it the marker's primary article (`primary: true`). */
export async function PATCH(request: Request, { params }: { params: Promise<{ markerId: string; linkId: string }> }) {
  const { markerId, linkId } = await params;
  const denied = await notInWorld("markers", markerId, "markerNotFound");
  if (denied) return denied;
  const link = await db.query.markerArticleLinks.findFirst({
    where: and(eq(markerArticleLinks.id, linkId), eq(markerArticleLinks.markerId, markerId)),
  });
  if (!link) return errorResponse("linkNotFound", 404);

  const body = await request.json().catch(() => null);
  if (!body) return errorResponse("invalidBody", 400);

  await db.transaction(async (tx) => {
    if (typeof body.label === "string") {
      await tx
        .update(markerArticleLinks)
        .set({ label: body.label.trim().slice(0, MAX_LABEL_LENGTH), updatedAt: new Date() })
        .where(eq(markerArticleLinks.id, linkId));
    }
    if (body.primary === true && !link.isPrimary) await setPrimaryLink(tx, markerId, linkId);
  });
  const updated = await db.query.markerArticleLinks.findFirst({ where: eq(markerArticleLinks.id, linkId) });
  return NextResponse.json({ link: updated });
}

/** Unlinks; removing the primary article promotes the oldest remaining link. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ markerId: string; linkId: string }> }) {
  const { markerId, linkId } = await params;
  const denied = await notInWorld("markers", markerId, "markerNotFound");
  if (denied) return denied;
  await removeLink(markerId, linkId);
  return NextResponse.json({ ok: true });
}
