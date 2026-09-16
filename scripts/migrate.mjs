import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function resolveDataModule() {
  // .mjs can't import the .ts source directly without a loader; resolve the
  // same paths data-dir.ts computes so both stay in sync.
  const os = await import("node:os");
  const override = process.env.WORLD_WIKI_DATA_DIR;
  const dataDir = override
    ? path.resolve(override)
    : path.join(os.homedir(), ".world-wiki-maps", "data");
  return { dataDir, dbFile: path.join(dataDir, "world-wiki.db") };
}

async function main() {
  const { dataDir, dbFile } = await resolveDataModule();
  const { mkdirSync } = await import("node:fs");
  mkdirSync(dataDir, { recursive: true });

  const client = createClient({ url: `file:${dbFile}` });
  await client.execute("PRAGMA foreign_keys = ON;");
  const db = drizzle(client);

  await migrate(db, { migrationsFolder: path.join(__dirname, "..", "drizzle") });
  console.log(`Migrations applied to ${dbFile}`);
  client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
