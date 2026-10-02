import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { maps, mapScaleBars } from "@/server/db/schema";
import { applyScalePatch, parseScaleConfig, type ScaleConfig } from "@/server/scale/scale-config";
import { getSettings } from "@/server/settings/store";
import { notInWorld } from "@/server/world/guards";

type ScaleRow = typeof mapScaleBars.$inferSelect;

/** A map without a scale bar yet starts in the user's distance unit (km or mi). */
async function defaultConfigJson(): Promise<string> {
  const { lengthSystem } = await getSettings();
  return JSON.stringify({ unit: lengthSystem === "imperial" ? "mi" : "km" });
}

const toClient = async (row: ScaleRow | undefined): Promise<{ visible: boolean; config: ScaleConfig }> => ({
  visible: row?.visible ?? false,
  config: parseScaleConfig(row?.config ?? (await defaultConfigJson())),
});

const findScale = (mapId: string) => db.query.mapScaleBars.findFirst({ where: eq(mapScaleBars.mapId, mapId) });

/** The map's scale bar (defaults, hidden and uncalibrated, when it has none yet). */
export async function GET(_request: Request, { params }: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await params;
  const denied = await notInWorld("maps", mapId, "Map not found.");
  if (denied) return denied;
  return NextResponse.json({ scaleBar: await toClient(await findScale(mapId)) });
}

/** Body: any of `visible`, `config` (partial, merged and validated). Creates the row on first use. */
export async function PUT(request: Request, { params }: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await params;
  const denied = await notInWorld("maps", mapId, "Map not found.");
  if (denied) return denied;
  const map = await db.query.maps.findFirst({ where: eq(maps.id, mapId) });
  if (!map) return NextResponse.json({ error: "Map not found." }, { status: 404 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const existing = await findScale(mapId);
  const current = await toClient(existing);
  const visible = typeof body.visible === "boolean" ? body.visible : current.visible;
  const config = JSON.stringify("config" in body ? applyScalePatch(current.config, body.config) : current.config);
  if (existing) {
    await db.update(mapScaleBars).set({ visible, config, updatedAt: new Date() }).where(eq(mapScaleBars.mapId, mapId));
  } else {
    await db.insert(mapScaleBars).values({ mapId, visible, config }).onConflictDoUpdate({ target: mapScaleBars.mapId, set: { visible, config, updatedAt: new Date() } });
  }
  return NextResponse.json({ scaleBar: await toClient(await findScale(mapId)) });
}
