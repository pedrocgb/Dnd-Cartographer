import { getInternalValue, getSettings, setInternalValue } from "../settings/store";
import { listTrash } from "./list";
import { purgeItems, type PurgeResult } from "./purge";

const HOUR_MS = 3_600_000;

/** Purges what has been in the Trash longer than the retention setting (nothing when it's "never"). */
export async function runAutoPurge(worldId: string, now = Date.now()): Promise<PurgeResult | null> {
  const { trashRetentionDays } = await getSettings(worldId);
  if (trashRetentionDays === null) return null;
  const cutoff = now - trashRetentionDays * 24 * HOUR_MS;
  const due = (await listTrash(worldId)).filter((item) => item.deletedAt <= cutoff);
  const result = due.length > 0 ? await purgeItems(due.map(({ kind, id }) => ({ kind, id }))) : null;
  await setInternalValue(worldId, "lastAutoPurgeAt", now);
  return result;
}

/** runAutoPurge at most once an hour (the Trash page triggers it; so does the worker, every few hours). */
export async function maybeAutoPurge(worldId: string, now = Date.now()): Promise<void> {
  const last = await getInternalValue(worldId, "lastAutoPurgeAt");
  if (last !== null && now - last < HOUR_MS) return;
  try {
    await runAutoPurge(worldId, now);
  } catch (err) {
    console.error("[trash] auto-purge failed:", err);
  }
}
