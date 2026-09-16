import { createClient } from "@libsql/client";
import path from "node:path";
import os from "node:os";

const dataDir = process.env.WORLD_WIKI_DATA_DIR
  ? path.resolve(process.env.WORLD_WIKI_DATA_DIR)
  : path.join(os.homedir(), ".world-wiki-maps", "data");
const dbFile = path.join(dataDir, "world-wiki.db");

const client = createClient({ url: `file:${dbFile}` });
const [assetId] = process.argv.slice(2);
if (!assetId) {
  console.error("Usage: node simulate-stuck-job.mjs <assetId>");
  process.exit(1);
}

const assetRow = await client.execute({ sql: "SELECT generation FROM map_assets WHERE id = ?", args: [assetId] });
const generation = assetRow.rows[0].generation;

const jobId = crypto.randomUUID();
const staleLease = Date.now() - 5 * 60 * 1000; // expired 5 minutes ago
await client.execute({
  sql: `INSERT INTO processing_jobs (id, asset_id, generation, state, attempts, lease_expires_at, created_at, updated_at)
        VALUES (?, ?, ?, 'processing', 1, ?, ?, ?)`,
  args: [jobId, assetId, generation, staleLease, Date.now(), Date.now()],
});
await client.execute({
  sql: "UPDATE map_assets SET state = 'processing', updated_at = ? WHERE id = ?",
  args: [Date.now(), assetId],
});

console.log(`Simulated stuck job ${jobId} for asset ${assetId} (generation ${generation}, lease expired 5 min ago)`);
client.close();
