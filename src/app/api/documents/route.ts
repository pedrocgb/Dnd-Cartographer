import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { richDocuments } from "@/server/db/schema";
import { ensureDefaultWorld } from "@/server/world/default-world";
import { SCHEMA_VERSION } from "@/server/documents/schema";

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

export async function POST() {
  const worldId = await ensureDefaultWorld();
  const [doc] = await db
    .insert(richDocuments)
    .values({
      worldId,
      jsonText: JSON.stringify(EMPTY_DOC),
      plainText: "",
      schemaVersion: SCHEMA_VERSION,
    })
    .returning();
  return NextResponse.json({ document: doc }, { status: 201 });
}
