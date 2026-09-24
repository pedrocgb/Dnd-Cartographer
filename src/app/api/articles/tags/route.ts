import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { articles, organizations, people, territories } from "@/server/db/schema";
import { ensureDefaultWorld } from "@/server/world/default-world";
import { parseTags } from "@/server/articles/tags";

/** Every manual tag in use across all articles, for autocomplete (sorted, unique ignoring case). */
export async function GET() {
  const worldId = await ensureDefaultWorld();
  const rows = await Promise.all(
    [articles, people, organizations, territories].map((t) =>
      db.select({ tags: t.tags }).from(t).where(and(eq(t.worldId, worldId), isNull(t.deletedAt)))
    )
  );
  const byKey = new Map<string, string>();
  for (const row of rows.flat()) {
    for (const tag of parseTags(row.tags)) if (!byKey.has(tag.toLowerCase())) byKey.set(tag.toLowerCase(), tag);
  }
  return NextResponse.json({ tags: [...byKey.values()].sort((a, b) => a.localeCompare(b)) });
}
