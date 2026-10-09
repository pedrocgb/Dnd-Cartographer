import { isPersonTemplate, isRecordTemplate, type ArticleTemplateKey } from "@/server/articles/templates";
import { textDocument } from "@/server/documents/from-text";
import { activeT } from "@/i18n/active";

async function ok(res: Response) {
  if (res.ok) return res.json();
  const data = await res.json().catch(() => ({}));
  throw new Error(data.error ?? activeT("articles")("manager.bodyFailed"));
}

const json = (method: string, body: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/**
 * Writes `text` as a just-created article's body. A generic article already
 * has an empty body (revision 0); a record (territory, character,
 * organization) gets its description document now.
 */
export async function seedArticleBody(template: ArticleTemplateKey, id: string, text: string) {
  if (!text.trim()) return;
  const doc = textDocument(text);
  if (isRecordTemplate(template)) {
    const { document } = await ok(await fetch("/api/documents", json("POST", { json: doc })));
    const path = isPersonTemplate(template) ? "people" : template === "territory" ? "territories" : "organizations";
    await ok(await fetch(`/api/politics/${path}/${id}`, json("PATCH", { descriptionDocumentId: document.id })));
    return;
  }
  const { article } = await ok(await fetch(`/api/articles/${id}`));
  if (article.bodyDocumentId) {
    await ok(await fetch(`/api/documents/${article.bodyDocumentId}`, json("PATCH", { json: doc, revision: 0 })));
  } else {
    const { document } = await ok(await fetch("/api/documents", json("POST", { json: doc })));
    await ok(await fetch(`/api/articles/${id}`, json("PATCH", { bodyDocumentId: document.id })));
  }
}
