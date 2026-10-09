import { NextResponse } from "next/server";
import { errorResponse } from "@/i18n/server";
import { requireWorldId } from "@/server/world/active-world";
import { createDocument, createEmptyDocument } from "@/server/documents/create";
import { DocumentValidationError } from "@/server/documents/schema";

/** A new rich document: empty, or with the given `json` content (validated). */
export async function POST(request: Request) {
  const worldId = await requireWorldId();
  const body = await request.json().catch(() => null);
  try {
    const doc = body?.json ? await createDocument(worldId, body.json) : await createEmptyDocument(worldId);
    return NextResponse.json({ document: doc }, { status: 201 });
  } catch (err) {
    if (err instanceof DocumentValidationError) return errorResponse(err.key, 400, undefined, err.params);
    throw err;
  }
}
