import { db } from "../db/client";
import { parseInfo, type InfoFieldSet } from "../articles/info-fields";
import { otherEndFor, wantedIds } from "./info-backing";
import { listRelations, resolveRecords, saveRelation, softDeleteRelations, type Executor } from "./store";

/** The record whose Info Bar is being saved. */
export interface SyncedRecord {
  id: string;
  worldId: string;
  /** Its `info` before this save (a field it had and no longer sends was removed). */
  previousInfo: Record<string, unknown>;
}

/**
 * Makes the record's relation-backed Info Bar fields true: for each such
 * field in the saved `info`, adds the relations it lists and soft-deletes
 * the ones it no longer lists. A field missing from `info` is left alone,
 * unless the record had it before (the user removed the field): then its
 * relations go. New relations take their type's defaults (a new parent is
 * biological, a new spouse's status unknown). Throws RelationError when one
 * isn't allowed (a parent loop, a kind of article the type doesn't take).
 */
export async function syncRelationFields(ex: Executor, set: InfoFieldSet, record: SyncedRecord, info: Record<string, unknown>) {
  const fields = set.fields.filter((f) => f.relation && (f.key in info || f.key in record.previousInfo));
  if (fields.length === 0) return;
  const live = await listRelations(record.worldId, ex);
  const wantedAll = fields.flatMap((f) => wantedIds(info[f.key]));
  const refs = await resolveRecords(record.worldId, [...wantedAll, ...live.flatMap((r) => [r.fromId, r.toId])], ex);
  const templateOf = (id: string) => refs.get(id)?.template ?? null;

  const drop: string[] = [];
  for (const field of fields) {
    const backing = field.relation!;
    const current = new Map<string, string>(); // other end -> relation id
    for (const rel of live) {
      const other = otherEndFor(field, record.id, rel, templateOf);
      if (other) current.set(other, rel.id);
    }
    const wanted = wantedIds(info[field.key]).filter((id) => {
      const template = templateOf(id);
      return id !== record.id && template !== null && field.link?.targets.includes(template);
    });
    for (const [other, relId] of current) if (!wanted.includes(other)) drop.push(relId);
    for (const other of wanted) {
      if (current.has(other)) continue;
      // "to" puts this record on the relation's `to` end (Parents: the parent is `from`).
      const [fromId, toId] = backing.side === "to" ? [other, record.id] : [record.id, other];
      await saveRelation(record.worldId, { type: backing.type, fromId, toId }, ex);
    }
  }
  await softDeleteRelations(drop, ex);
}

/**
 * Runs a record's update and the sync of its relation fields in one
 * transaction: a tie that isn't allowed rolls the whole save back
 * (RelationError). `rawInfo` is the PATCH body's `info`; nothing is synced
 * when it isn't an object.
 */
export async function withRelationSync<T>(
  set: InfoFieldSet,
  record: { id: string; worldId: string; info: string },
  rawInfo: unknown,
  write: (ex: Executor) => Promise<T>
): Promise<T> {
  if (!rawInfo || typeof rawInfo !== "object" || Array.isArray(rawInfo)) return write(db);
  return db.transaction(async (tx) => {
    const result = await write(tx);
    await syncRelationFields(tx, set, { id: record.id, worldId: record.worldId, previousInfo: parseInfo(record.info) }, rawInfo as Record<string, unknown>);
    return result;
  });
}
