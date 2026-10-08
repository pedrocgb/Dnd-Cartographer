import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/server/db/client";
import { documentMentions, richDocuments } from "@/server/db/schema";
import { extractMentions } from "@/server/mentions/kinds";
import { validateDocument, deriveText, DocumentValidationError, SCHEMA_VERSION } from "@/server/documents/schema";
import { notInWorld } from "@/server/world/guards";
import { errorResponse } from "@/i18n/server";

export async function GET(_request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params;
  const denied = await notInWorld("rich_documents", documentId, "documentNotFound");
  if (denied) return denied;
  const doc = await db.query.richDocuments.findFirst({ where: eq(richDocuments.id, documentId) });
  if (!doc) {
    return errorResponse("documentNotFound", 404);
  }
  return NextResponse.json({ document: doc });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params;
  const denied = await notInWorld("rich_documents", documentId, "documentNotFound");
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  const revision = Number(body?.revision);

  if (!body?.json || !Number.isFinite(revision)) {
    return errorResponse("documentSaveBody", 400);
  }

  try {
    validateDocument(body.json);
  } catch (err) {
    if (err instanceof DocumentValidationError) {
      return errorResponse(err.key, 400, undefined, err.params);
    }
    throw err;
  }

  const current = await db.query.richDocuments.findFirst({ where: eq(richDocuments.id, documentId) });
  if (!current) {
    return errorResponse("documentNotFound", 404);
  }

  if (current.revision !== revision) {
    // The caller's edit was based on a now-superseded revision. Rather than
    // silently overwrite (or discard) anything, hand back the current
    // server state so the client can decide how to reconcile.
    return errorResponse("documentChanged", 409, { current });
  }

  const jsonText = JSON.stringify(body.json);
  const plainText = deriveText(body.json);

  const mentions = extractMentions(body.json);

  // The backlink index is rewritten with the text, so the two never disagree.
  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(richDocuments)
      .set({ jsonText, plainText, schemaVersion: SCHEMA_VERSION, revision: revision + 1, updatedAt: new Date() })
      .where(and(eq(richDocuments.id, documentId), eq(richDocuments.revision, revision)))
      .returning();
    if (!row) return null;
    await tx.delete(documentMentions).where(eq(documentMentions.documentId, documentId));
    if (mentions.length) {
      await tx.insert(documentMentions).values(mentions.map((m) => ({ documentId, targetKind: m.kind, targetId: m.id, label: m.label })));
    }
    return row;
  });

  if (!updated) {
    // Another save won the race between our read and this write.
    const latest = await db.query.richDocuments.findFirst({ where: eq(richDocuments.id, documentId) });
    return errorResponse("documentChanged", 409, { current: latest });
  }

  return NextResponse.json({ document: updated });
}
