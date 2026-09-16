import { spawn } from "node:child_process";
import { rm, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { cleanupOrphans } from "./cleanup-orphans.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const mode = process.argv.includes("--dev") ? "dev" : "start";

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: "inherit", shell: true });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`))));
  });
}

// Long-running child (server or worker): started and left running, killed
// together with this launcher process.
function runLong(command, args) {
  const child = spawn(command, args, { cwd: root, stdio: "inherit", shell: true });
  child.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`${command} ${args.join(" ")} exited with code ${code}`);
    }
  });
  return child;
}

async function cleanOrphanedTemp() {
  // Uploads aren't resumable yet (see plan section 6) — anything left in
  // temp/ is from an interrupted upload and is safe to discard on startup.
  const dataDir = process.env.WORLD_WIKI_DATA_DIR
    ? path.resolve(process.env.WORLD_WIKI_DATA_DIR)
    : path.join(os.homedir(), ".world-wiki-maps", "data");
  const tempDir = path.join(dataDir, "temp");
  try {
    const entries = await readdir(tempDir);
    await Promise.all(entries.map((e) => rm(path.join(tempDir, e), { recursive: true, force: true })));
    if (entries.length > 0) console.log(`Cleaned ${entries.length} orphaned temp upload(s).`);
  } catch {
    // temp dir doesn't exist yet — nothing to clean.
  }
}

async function main() {
  console.log("World Wiki — Maps: starting local workspace");
  await run("node", ["scripts/migrate.mjs"]);
  await cleanOrphanedTemp();
  const orphansRemoved = await cleanupOrphans();
  if (orphansRemoved > 0) console.log(`Removed ${orphansRemoved} orphaned asset director(ies).`);

  if (mode === "start") {
    await run("npm", ["run", "build"]);
  }

  const nextArgs = mode === "dev" ? ["run", "dev"] : ["run", "start"];
  process.env.HOSTNAME = "127.0.0.1"; // bind to loopback — single-user localhost app

  const children = [runLong("npx", ["tsx", "src/worker/index.ts"]), runLong("npm", [...nextArgs, "--", "-H", "127.0.0.1"])];

  const shutdown = () => {
    for (const child of children) child.kill();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
