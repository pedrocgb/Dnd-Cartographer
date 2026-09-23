import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { organizations, people, territories } from "@/server/db/schema";
import { processPortraitUpload, deletePortraitFile, InvalidImageError } from "@/server/assets/portrait-upload";
import type { PortraitOwnerType } from "@/server/assets/portrait-paths";

const OWNERS = {
  territory: { table: territories, label: "Territory" },
  person: { table: people, label: "Person" },
  organization: { table: organizations, label: "Organization" },
} as const;

type RouteContext = { params: Promise<{ id: string }> };

/** POST/DELETE handlers for `/api/politics/<owner>/[id]/portrait` — identical for every portrait owner but the table. */
export function portraitRouteHandlers(ownerType: PortraitOwnerType) {
  const { table, label } = OWNERS[ownerType];

  async function exists(id: string) {
    const [row] = await db.select({ id: table.id }).from(table).where(eq(table.id, id)).limit(1);
    return Boolean(row);
  }

  async function setPortraitKey(id: string, portraitKey: string | null) {
    await db.update(table).set({ portraitKey, updatedAt: new Date() }).where(eq(table.id, id));
    return NextResponse.json({ portraitKey });
  }

  const notFound = () => NextResponse.json({ error: `${label} not found.` }, { status: 404 });

  return {
    async POST(request: Request, { params }: RouteContext) {
      const { id } = await params;
      if (!(await exists(id))) return notFound();
      if (!request.body) return NextResponse.json({ error: "Empty upload." }, { status: 400 });

      let key: string;
      try {
        key = await processPortraitUpload(ownerType, id, request.body);
      } catch (err) {
        if (err instanceof InvalidImageError) return NextResponse.json({ error: err.message }, { status: 400 });
        throw err;
      }
      return setPortraitKey(id, key);
    },

    async DELETE(_request: Request, { params }: RouteContext) {
      const { id } = await params;
      if (!(await exists(id))) return notFound();
      await deletePortraitFile(ownerType, id);
      return setPortraitKey(id, null);
    },
  };
}
