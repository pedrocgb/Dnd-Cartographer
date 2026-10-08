import { NextResponse } from "next/server";
import { errorResponse } from "@/i18n/server";
import { eq, and } from "drizzle-orm";
import { requireWorldId } from "@/server/world/active-world";
import { db } from "@/server/db/client";
import { articles, organizations, people, territories } from "@/server/db/schema";
import { adjustPortrait, deletePortraitFile, InvalidImageError, portraitSource, processPortraitUpload } from "@/server/assets/portrait-upload";
import { parsePortraitCrop } from "@/server/assets/portrait-crop";
import { portraitKey, type PortraitOwnerType } from "@/server/assets/portrait-paths";

const OWNERS = {
  territory: { table: territories, notFound: "territoryNotFound" },
  person: { table: people, notFound: "personNotFound" },
  organization: { table: organizations, notFound: "organizationNotFound" },
  article: { table: articles, notFound: "articleNotFound" },
} as const;

function parseJson(text: string | null): unknown {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET/POST/PUT/DELETE handlers for `/api/politics/<owner>/[id]/portrait` — identical for every portrait owner but the table.
 * POST uploads (the crop rides in the `crop` query param, since the body is the image);
 * PUT re-crops the kept original; GET says what the crop dialog should load.
 */
export function portraitRouteHandlers(ownerType: PortraitOwnerType) {
  const { table, notFound: notFoundKey } = OWNERS[ownerType];

  async function exists(id: string) {
    const worldId = await requireWorldId();
    const [row] = await db.select({ id: table.id }).from(table).where(and(eq(table.id, id), eq(table.worldId, worldId))).limit(1);
    return Boolean(row);
  }

  async function setPortraitKey(id: string, key: string | null) {
    await db.update(table).set({ portraitKey: key, updatedAt: new Date() }).where(eq(table.id, id));
    return NextResponse.json({ portraitKey: key });
  }

  const notFound = () => errorResponse(notFoundKey, 404);

  return {
    async GET(_request: Request, { params }: RouteContext) {
      const { id } = await params;
      if (!(await exists(id))) return notFound();
      return NextResponse.json(await portraitSource(ownerType, id));
    },

    async POST(request: Request, { params }: RouteContext) {
      const { id } = await params;
      if (!(await exists(id))) return notFound();
      if (!request.body) return errorResponse("imageEmpty", 400);

      let key: string;
      try {
        const crop = parsePortraitCrop(parseJson(new URL(request.url).searchParams.get("crop")));
        key = await processPortraitUpload(ownerType, id, request.body, crop);
      } catch (err) {
        if (err instanceof InvalidImageError) return errorResponse(err.key, 400, undefined, err.params);
        throw err;
      }
      return setPortraitKey(id, key);
    },

    async PUT(request: Request, { params }: RouteContext) {
      const { id } = await params;
      if (!(await exists(id))) return notFound();
      const crop = parsePortraitCrop((await request.json().catch(() => null))?.crop);
      if (!crop) return errorResponse("cropInvalid", 400);
      if (!(await adjustPortrait(ownerType, id, crop))) return errorResponse("noImageToAdjust", 404);
      // Bumps updatedAt too, so the displayed image cache-busts.
      return setPortraitKey(id, portraitKey(ownerType, id));
    },

    async DELETE(_request: Request, { params }: RouteContext) {
      const { id } = await params;
      if (!(await exists(id))) return notFound();
      await deletePortraitFile(ownerType, id);
      return setPortraitKey(id, null);
    },
  };
}
