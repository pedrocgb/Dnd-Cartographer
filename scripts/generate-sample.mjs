import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const WIDTH = 7680;
const HEIGHT = 4320;
const COLS = 16;
const ROWS = 9;
const CELL_W = WIDTH / COLS;
const CELL_H = HEIGHT / ROWS;

const OUT_DIR = path.join(process.cwd(), "data", "originals");
const OUT_FILE = path.join(OUT_DIR, "sample-map.png");

function buildSvg() {
  const cells = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const x = col * CELL_W;
      const y = row * CELL_H;
      const hue = (row * COLS + col) % 2 === 0 ? "#cfead9" : "#bfe0d0";
      cells.push(
        `<rect x="${x}" y="${y}" width="${CELL_W}" height="${CELL_H}" fill="${hue}" stroke="#8fae9c" stroke-width="2" />`
      );
      cells.push(
        `<text x="${x + 24}" y="${y + 48}" font-family="Georgia, serif" font-size="34" fill="#33443a">${String.fromCharCode(65 + row)}${col + 1}</text>`
      );
    }
  }

  const labels = [];
  const cities = [
    ["Harrowgate", 0.12, 0.18],
    ["Ashen Reach", 0.34, 0.62],
    ["Vellmoor", 0.58, 0.28],
    ["Duskhaven", 0.77, 0.71],
    ["Ninestone Hold", 0.9, 0.15],
    ["Crownwatch", 0.47, 0.85],
  ];
  for (const [name, u, v] of cities) {
    const x = u * WIDTH;
    const y = v * HEIGHT;
    labels.push(
      `<circle cx="${x}" cy="${y}" r="10" fill="#6b3d21" />` +
        `<text x="${x + 16}" y="${y + 6}" font-family="Georgia, serif" font-size="30" font-weight="700" fill="#3a2313">${name}</text>` +
        `<text x="${x + 16}" y="${y + 34}" font-family="Georgia, serif" font-size="16" fill="#5a4231">fine-detail label check 8pt</text>`
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
    <rect width="${WIDTH}" height="${HEIGHT}" fill="#dff0e3" />
    ${cells.join("\n")}
    ${labels.join("\n")}
    <text x="${WIDTH / 2 - 520}" y="${HEIGHT / 2}" font-family="Georgia, serif" font-size="120" fill="#274b3a" opacity="0.35">World Wiki Sample Map</text>
    <text x="40" y="${HEIGHT - 40}" font-family="Georgia, serif" font-size="26" fill="#274b3a">${WIDTH} x ${HEIGHT} px synthetic benchmark image</text>
  </svg>`;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const svg = buildSvg();
  await sharp(Buffer.from(svg)).png().toFile(OUT_FILE);
  console.log(`Wrote ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
