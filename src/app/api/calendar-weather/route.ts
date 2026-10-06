import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { calendarWeather } from "@/server/db/schema";
import { requireWorldId } from "@/server/world/active-world";
import { readBody } from "@/server/calendars/respond";
import { verifiedArticleName } from "@/server/articles/lookup";
import { MAX_WORLD_DAY, attachedDays, weatherOnDay } from "@/server/calendars/weather";
import { readWeatherDay } from "@/lib/weather/validate";
import { HISTORY_MAX } from "@/lib/tool-history";

const bad = (error: string) => NextResponse.json({ error }, { status: 400 });
const isWorldDay = (v: unknown): v is number => Number.isInteger(v) && Math.abs(v as number) <= MAX_WORLD_DAY;

/**
 * `?day=N`: the weather attached to that day, with its places' names.
 * `?ids=a,b`: which of these attachments still exist, as `{ days: { id: worldDay } }`.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const worldId = await requireWorldId();
  const ids = params.get("ids");
  if (ids !== null) {
    const list = [...new Set(ids.split(",").filter(Boolean))];
    if (list.length > HISTORY_MAX * 10) return bad("Too many ids.");
    return NextResponse.json({ days: await attachedDays(worldId, list) });
  }
  const day = Number(params.get("day"));
  if (!params.get("day") || !isWorldDay(day)) return bad("A day is required.");
  return NextResponse.json({ weather: await weatherOnDay(worldId, day) });
}

/** Attaches a generated day: `{ worldDay, day, settlementId?, territoryId? }`. */
export async function POST(request: Request) {
  const body = await readBody(request);
  if (!body) return bad("Invalid request body.");
  if (!isWorldDay(body.worldDay)) return bad("Pick a valid calendar day.");
  const day = readWeatherDay(body.day);
  if (!day) return bad("That weather report is incomplete or invalid.");

  const worldId = await requireWorldId();
  const place = async (template: "settlement" | "territory", id: unknown) => {
    if (id === undefined || id === null || id === "") return null;
    if (typeof id !== "string" || !(await verifiedArticleName(worldId, template, id))) return false;
    return id;
  };
  const settlementId = await place("settlement", body.settlementId);
  const territoryId = await place("territory", body.territoryId);
  if (settlementId === false || territoryId === false) return bad("That settlement or territory doesn't exist anymore.");

  const [row] = await db.insert(calendarWeather).values({ worldId, worldDay: body.worldDay, data: JSON.stringify(day), settlementId, territoryId }).returning();
  return NextResponse.json({ id: row.id, worldDay: row.worldDay }, { status: 201 });
}
