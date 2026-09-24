import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { articles, organizations, people, territories } from "@/server/db/schema";
import { adjustPortrait, deletePortraitFile, InvalidImageError, portraitSource, processPortraitUpload } from "@/server/assets/portrait-upload";
import { parsePortraitCrop } from "@/server/assets/portrait-crop";
import { portraitKey, type PortraitOwnerType } from "@/server/assets/portrait-paths";

const OWNERS = {
  territory: { table: territories, label: "Territory" },
  person: { table: people, label: "Person" },
  organization: { table: organizations, label: "Organization" },
  article: { table: articles, label: "Article" },
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
  const { table, label } = OWNERS[ownerType];

  async function exists(id: string) {
    const [row] = await db.select({ id: table.id }).from(table).where(eq(table.id, id)).limit(1);
    return Boolean(row);
  }

  async function setPortraitKey(id: string, key: string | null) {
    await db.update(table).set({ portraitKey: key, updatedAt: new Date() }).where(eq(table.id, id));
    return NextResponse.json({ portraitKey: key });
  }

  const notFound = () => NextResponse.json({ error: `${label} not found.` }, { status: 404 });

  return {
    async GET(_request: Request, { params }: RouteContext) {
      const { id } = await params;
      if (!(await exists(id))) return notFound();
      return NextResponse.json(await portraitSource(ownerType, id));
    },

    async POST(request: Request, { params }: RouteContext) {
      const { id } = await params;
      if (!(await exists(id))) return notFound();
      if (!request.body) return NextResponse.json({ error: "Empty upload." }, { status: 400 });

      let key: string;
      try {
        const crop = parsePortraitCrop(parseJson(new URL(request.url).searchParams.get("crop")));
        key = await processPortraitUpload(ownerType, id, request.body, crop);
      } catch (err) {
        if (err instanceof InvalidImageError) return NextResponse.json({ error: err.message }, { status: 400 });
        throw err;
      }
      return setPortraitKey(id, key);
    },

    async PUT(request: Request, { params }: RouteContext) {
      const { id } = await params;
      if (!(await exists(id))) return notFound();
      const crop = parsePortraitCrop((await request.json().catch(() => null))?.crop);
      if (!crop) return NextResponse.json({ error: "Invalid crop." }, { status: 400 });
      if (!(await adjustPortrait(ownerType, id, crop))) return NextResponse.json({ error: "There is no image to adjust." }, { status: 404 });
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
