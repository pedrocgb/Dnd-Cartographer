import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/server/db/client";
import { richDocuments } from "@/server/db/schema";
import { validateDocument, deriveText, DocumentValidationError, SCHEMA_VERSION } from "@/server/documents/schema";

export async function GET(_request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params;
  const doc = await db.query.richDocuments.findFirst({ where: eq(richDocuments.id, documentId) });
  if (!doc) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }
  return NextResponse.json({ document: doc });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params;
  const body = await request.json().catch(() => null);
  const revision = Number(body?.revision);

  if (!body?.json || !Number.isFinite(revision)) {
    return NextResponse.json({ error: "Request must include json and revision." }, { status: 400 });
  }

  try {
    validateDocument(body.json);
  } catch (err) {
    if (err instanceof DocumentValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  const current = await db.query.richDocuments.findFirst({ where: eq(richDocuments.id, documentId) });
  if (!current) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  if (current.revision !== revision) {
    // The caller's edit was based on a now-superseded revision. Rather than
    // silently overwrite (or discard) anything, hand back the current
    // server state so the client can decide how to reconcile.
    return NextResponse.json(
      { error: "This document changed since you loaded it.", current },
      { status: 409 }
    );
  }

  const jsonText = JSON.stringify(body.json);
  const plainText = deriveText(body.json);

  const [updated] = await db
    .update(richDocuments)
    .set({ jsonText, plainText, schemaVersion: SCHEMA_VERSION, revision: revision + 1, updatedAt: new Date() })
    .where(and(eq(richDocuments.id, documentId), eq(richDocuments.revision, revision)))
    .returning();

  if (!updated) {
    // Another save won the race between our read and this write.
    const latest = await db.query.richDocuments.findFirst({ where: eq(richDocuments.id, documentId) });
    return NextResponse.json({ error: "This document changed since you loaded it.", current: latest }, { status: 409 });
  }

  return NextResponse.json({ document: updated });
}
