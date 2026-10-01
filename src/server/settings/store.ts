import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { appSettings } from "../db/schema";
import { parseStoredSettings, type AppSettings } from "./settings";

async function readRaw(worldId: string): Promise<Record<string, unknown>> {
  const row = await db.query.appSettings.findFirst({ where: eq(appSettings.worldId, worldId) });
  try {
    const parsed: unknown = row ? JSON.parse(row.data) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

async function writeRaw(worldId: string, data: Record<string, unknown>) {
  const json = JSON.stringify(data);
  const updatedAt = new Date();
  await db
    .insert(appSettings)
    .values({ worldId, data: json, updatedAt })
    .onConflictDoUpdate({ target: appSettings.worldId, set: { data: json, updatedAt } });
}

export async function getSettings(worldId: string): Promise<AppSettings> {
  return parseStoredSettings(await readRaw(worldId));
}

/** Merges an already-sanitized patch into the stored settings; returns the result. */
export async function updateSettings(worldId: string, patch: Partial<AppSettings>): Promise<AppSettings> {
  const next = { ...(await readRaw(worldId)), ...patch };
  await writeRaw(worldId, next);
  return parseStoredSettings(next);
}

/** Bookkeeping values kept next to the settings but never sent to the client. */
type InternalKey = "lastAutoPurgeAt";

export async function getInternalValue(worldId: string, key: InternalKey): Promise<number | null> {
  const value = (await readRaw(worldId))[key];
  return typeof value === "number" ? value : null;
}

export async function setInternalValue(worldId: string, key: InternalKey, value: number) {
  const raw = await readRaw(worldId);
  await writeRaw(worldId, { ...raw, [key]: value });
}
