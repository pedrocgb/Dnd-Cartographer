import { NextResponse } from "next/server";
import { ensureDefaultWorld } from "@/server/world/default-world";
import { buildExport } from "@/server/portability/build-export";

export const runtime = "nodejs";

export async function GET() {
  const worldId = await ensureDefaultWorld();
  const bundle = await buildExport(worldId);
  const filename = `world-wiki-export-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(bundle), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
