import { describe, expect, it } from "vitest";
import { getTableConfig, SQLiteTable } from "drizzle-orm/sqlite-core";
import { is } from "drizzle-orm";
import * as schema from "../src/server/db/schema";
import { worldDeletePlan, worldFilterSql } from "../src/server/world/delete-plan";

const tables = (Object.values(schema) as unknown[]).filter((v): v is SQLiteTable => is(v, SQLiteTable)).map((t) => getTableConfig(t));

describe("world delete plan", () => {
  const plan = worldDeletePlan();
  const order = plan.map((s) => s.table);

  it("covers every table but the worlds and the app-wide settings", () => {
    const expected = tables.map((t) => t.name).filter((n) => n !== "worlds" && n !== "app_settings");
    expect([...order].sort()).toEqual([...expected].sort());
  });

  it("deletes each table before the tables it points at", () => {
    for (const t of tables) {
      if (!order.includes(t.name)) continue;
      for (const fk of t.foreignKeys) {
        const parent = getTableConfig(fk.reference().foreignTable).name;
        if (parent === t.name || !order.includes(parent)) continue;
        expect(order.indexOf(t.name), `${t.name} before ${parent}`).toBeLessThan(order.indexOf(parent));
      }
    }
  });

  it("ties tables with a world_id by it alone, and the rest through a parent", () => {
    expect(worldFilterSql(plan, "maps").where).toBe(`"world_id" = ?`);
    expect(worldFilterSql(plan, "markers").where).toContain(`"map_id" IN (SELECT "id" FROM "maps" WHERE "world_id" = ?)`);
    expect(worldFilterSql(plan, "processing_jobs").where).toContain(`FROM "map_assets"`);
  });

  it("refuses a table it can't tie to a world", () => {
    expect(() => worldDeletePlan([{ name: "orphans", hasWorldId: false, fks: [] }])).toThrow(/orphans/);
  });
});
