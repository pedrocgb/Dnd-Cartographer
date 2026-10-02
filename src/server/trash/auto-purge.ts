import { db } from "../db/client";
import { worlds } from "../db/schema";
import { getInternalValue, getSettings, setInternalValue } from "../settings/store";
import { listTrash } from "./list";
import { purgeItems, type PurgeResult } from "./purge";

const HOUR_MS = 3_600_000;

/** Purges what has been in every world's Trash longer than the retention setting (nothing when it's "never"). */
export async function runAutoPurge(now = Date.now()): Promise<PurgeResult[]> {
  const { trashRetentionDays } = await getSettings();
  if (trashRetentionDays === null) return [];
  const cutoff = now - trashRetentionDays * 24 * HOUR_MS;
  const results: PurgeResult[] = [];
  for (const { id } of await db.select({ id: worlds.id }).from(worlds)) {
    const due = (await listTrash(id)).filter((item) => item.deletedAt <= cutoff);
    if (due.length > 0) results.push(await purgeItems(due.map(({ kind, id: itemId }) => ({ kind, id: itemId }))));
  }
  await setInternalValue("lastAutoPurgeAt", now);
  return results;
}

/** runAutoPurge at most once an hour (the Trash page triggers it; so does the worker, every few hours). */
export async function maybeAutoPurge(now = Date.now()): Promise<void> {
  const last = await getInternalValue("lastAutoPurgeAt");
  if (last !== null && now - last < HOUR_MS) return;
  try {
    await runAutoPurge(now);
  } catch (err) {
    console.error("[trash] auto-purge failed:", err);
  }
}
