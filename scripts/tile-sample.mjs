import sharp from "sharp";
import { mkdir, stat, rm } from "node:fs/promises";
import path from "node:path";

const SRC = path.join(process.cwd(), "data", "originals", "sample-map.png");
const TILE_DIR = path.join(process.cwd(), "data", "tiles");
const OUT_BASENAME = "sample-map";

async function dirSize(dir) {
  let total = 0;
  const { readdir } = await import("node:fs/promises");
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += await dirSize(full);
    } else {
      total += (await stat(full)).size;
    }
  }
  return total;
}

async function main() {
  await mkdir(TILE_DIR, { recursive: true });
  await rm(path.join(TILE_DIR, `${OUT_BASENAME}_files`), { recursive: true, force: true });
  await rm(path.join(TILE_DIR, `${OUT_BASENAME}.dzi`), { force: true });

  const srcStat = await stat(SRC);
  const meta = await sharp(SRC).metadata();
  console.log(`Source: ${meta.width}x${meta.height}, ${(srcStat.size / 1024 / 1024).toFixed(2)} MiB`);

  const start = performance.now();
  await sharp(SRC, { limitInputPixels: false })
    .tile({
      size: 512,
      overlap: 1,
      layout: "dz",
      format: "webp",
    })
    .toFile(path.join(TILE_DIR, OUT_BASENAME));
  const elapsedMs = performance.now() - start;

  const tilesBytes = await dirSize(path.join(TILE_DIR, `${OUT_BASENAME}_files`));

  console.log(`Tiling complete in ${(elapsedMs / 1000).toFixed(2)}s`);
  console.log(`Tile pyramid size on disk: ${(tilesBytes / 1024 / 1024).toFixed(2)} MiB`);
  console.log(`DZI descriptor: ${path.join(TILE_DIR, `${OUT_BASENAME}.dzi`)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
