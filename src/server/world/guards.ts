import { NextResponse } from "next/server";
import { sql, type SQL } from "drizzle-orm";
import { db } from "../db/client";
import { requireWorldId } from "./active-world";
import { worldDeletePlan, worldFilterSql } from "./delete-plan";

const plan = worldDeletePlan();

/** Tables a by-id route may guard: any table tied to a world (see delete-plan.ts). */
export type WorldTable = (typeof plan)[number]["table"];

/** SQL selecting the rows of `table` that belong to the world (directly, or through its map, campaign…). */
export function worldRowsFilter(table: WorldTable, worldId: string): SQL {
  const [head, ...rest] = worldFilterSql(plan, table).where.split("?");
  return sql.join([sql.raw(head), ...rest.map((part) => sql`${worldId}${sql.raw(part)}`)], sql.raw(""));
}

/** Whether row `id` of `table` belongs to the world. */
export async function rowInWorld(table: WorldTable, id: string, worldId: string): Promise<boolean> {
  // db.all, not db.get: drizzle's libsql get() throws when no row matches.
  const rows = await db.all(sql`SELECT 1 AS hit FROM ${sql.identifier(table)} WHERE "id" = ${id} AND (${worldRowsFilter(table, worldId)}) LIMIT 1`);
  return rows.length > 0;
}

/**
 * For by-id routes: a 404 response when the row isn't in the open world
 * (missing, or another world's), else null. `const denied = await notInWorld("markers", id); if (denied) return denied;`
 */
export async function notInWorld(table: WorldTable, id: string, what = "Not found."): Promise<NextResponse | null> {
  return (await rowInWorld(table, id, await requireWorldId())) ? null : NextResponse.json({ error: what }, { status: 404 });
}

/** Whether every given id (null/undefined ones are skipped) is a row of the world, e.g. a document or category picked in a body. */
export async function idsInWorld(worldId: string, refs: [WorldTable, string | null | undefined][]): Promise<boolean> {
  for (const [table, id] of refs) if (id && !(await rowInWorld(table, id, worldId))) return false;
  return true;
}

/** The 400 answer when a body names something from another world (or nothing). */
export const foreignIdResponse = () => NextResponse.json({ error: "That points at something that isn't in this world." }, { status: 400 });
