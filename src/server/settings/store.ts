import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { appSettings } from "../db/schema";
import { parseStoredSettings, type AppSettings } from "./settings";

/** Settings are app-wide (shared by every world): one row. */
const ROW_ID = "app";

async function readRaw(): Promise<Record<string, unknown>> {
  const row = await db.query.appSettings.findFirst({ where: eq(appSettings.id, ROW_ID) });
  try {
    const parsed: unknown = row ? JSON.parse(row.data) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

async function writeRaw(data: Record<string, unknown>) {
  const json = JSON.stringify(data);
  const updatedAt = new Date();
  await db
    .insert(appSettings)
    .values({ id: ROW_ID, data: json, updatedAt })
    .onConflictDoUpdate({ target: appSettings.id, set: { data: json, updatedAt } });
}

export async function getSettings(): Promise<AppSettings> {
  return parseStoredSettings(await readRaw());
}

/** Merges an already-sanitized patch into the stored settings; returns the result. */
export async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const next = { ...(await readRaw()), ...patch };
  await writeRaw(next);
  return parseStoredSettings(next);
}

/** Bookkeeping values kept next to the settings but never sent to the client. */
type InternalKey = "lastAutoPurgeAt";

export async function getInternalValue(key: InternalKey): Promise<number | null> {
  const value = (await readRaw())[key];
  return typeof value === "number" ? value : null;
}

export async function setInternalValue(key: InternalKey, value: number) {
  const raw = await readRaw();
  await writeRaw({ ...raw, [key]: value });
}
