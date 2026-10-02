/**
 * Which rows of each table belong to a world, and the order to delete them
 * in, read from the schema's foreign keys (pure: no DB). A table either has a
 * `world_id`, or reaches one through its foreign keys (markers → maps,
 * processing_jobs → map_assets → maps…). Children go before the tables they
 * point at, so each child's filter can still see its parents.
 */
import { is } from "drizzle-orm";
import { getTableConfig, SQLiteTable } from "drizzle-orm/sqlite-core";
import * as schema from "../db/schema";

/** Tables that belong to no world: the worlds themselves and the app-wide settings. */
const OUTSIDE_WORLDS = new Set(["worlds", "app_settings"]);

/** How a table's rows are tied to a world: its own `world_id`, or a column pointing at a parent table. */
export type WorldLink = { kind: "world" } | { kind: "parent"; column: string; parent: string; parentColumn: string };

export interface DeleteStep {
  table: string;
  /** Any one of these ties a row to the world: its world_id alone when it has one. */
  links: WorldLink[];
}

export interface TableInfo {
  name: string;
  hasWorldId: boolean;
  fks: { column: string; parent: string; parentColumn: string }[];
}

function tableInfos(): TableInfo[] {
  const tables = (Object.values(schema) as unknown[]).filter((v): v is SQLiteTable => is(v, SQLiteTable));
  return tables.map((t) => {
    const config = getTableConfig(t);
    return {
      name: config.name,
      hasWorldId: config.columns.some((c) => c.name === "world_id"),
      fks: config.foreignKeys.flatMap((fk) => {
        const ref = fk.reference();
        if (ref.columns.length !== 1) return [];
        return [{ column: ref.columns[0].name, parent: getTableConfig(ref.foreignTable).name, parentColumn: ref.foreignColumns[0].name }];
      }),
    };
  });
}

/** The delete steps for one world, children first; throws if a table can't be tied to a world or the keys form a cycle. */
export function worldDeletePlan(infos: TableInfo[] = tableInfos()): DeleteStep[] {
  const byName = new Map(infos.map((t) => [t.name, t]));
  const inWorld = infos.filter((t) => !OUTSIDE_WORLDS.has(t.name));

  // Tables tied to a world: those with world_id, then (repeatedly) those pointing at a tied table.
  const tied = new Set(inWorld.filter((t) => t.hasWorldId).map((t) => t.name));
  for (let grew = true; grew; ) {
    grew = false;
    for (const t of inWorld) {
      if (!tied.has(t.name) && t.fks.some((fk) => fk.parent !== t.name && tied.has(fk.parent))) {
        tied.add(t.name);
        grew = true;
      }
    }
  }
  const loose = inWorld.filter((t) => !tied.has(t.name)).map((t) => t.name);
  if (loose.length) throw new Error(`No way to tie these tables to a world: ${loose.join(", ")}`);

  // Children before parents (a table's own self-references don't count).
  const order: string[] = [];
  const left = new Set(tied);
  while (left.size) {
    const ready = [...left].filter((name) => ![...left].some((other) => other !== name && byName.get(other)!.fks.some((fk) => fk.parent === name)));
    if (ready.length === 0) throw new Error(`Foreign keys form a cycle among: ${[...left].join(", ")}`);
    for (const name of ready.sort()) {
      order.push(name);
      left.delete(name);
    }
  }

  return order.map((name) => {
    const t = byName.get(name)!;
    // A table's own world_id decides; otherwise any of its parents in the world does.
    const links: WorldLink[] = t.hasWorldId ? [{ kind: "world" }] : t.fks.filter((fk) => fk.parent !== name && tied.has(fk.parent)).map((fk) => ({ kind: "parent", ...fk }));
    return { table: name, links };
  });
}

/**
 * SQL (with `?` for the world id, once per use) selecting a table's rows of the world.
 * Identifiers come from the schema, never from input.
 */
export function worldFilterSql(plan: DeleteStep[], table: string): { where: string; params: number } {
  const steps = new Map(plan.map((s) => [s.table, s]));
  const memo = new Map<string, { where: string; params: number }>();
  const build = (name: string): { where: string; params: number } => {
    const hit = memo.get(name);
    if (hit) return hit;
    const parts = steps.get(name)!.links.map((link) => {
      if (link.kind === "world") return { where: `"world_id" = ?`, params: 1 };
      const parent = build(link.parent);
      return { where: `"${link.column}" IN (SELECT "${link.parentColumn}" FROM "${link.parent}" WHERE ${parent.where})`, params: parent.params };
    });
    const result = { where: parts.length === 1 ? parts[0].where : parts.map((p) => `(${p.where})`).join(" OR "), params: parts.reduce((n, p) => n + p.params, 0) };
    memo.set(name, result);
    return result;
  };
  return build(table);
}
