import type { EditorView } from "@tiptap/pm/view";

const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export function isAcceptedImage(file: File): boolean {
  return ACCEPTED_TYPES.has(file.type);
}

/** Uploads one image (raw body, like portraits) and resolves its served URL. */
export async function uploadArticleImage(file: File): Promise<string> {
  const res = await fetch("/api/article-images", {
    method: "POST",
    headers: { "Content-Type": file.type },
    body: file,
  });
  const data: { src?: string; error?: string } = await res.json().catch(() => ({}));
  if (!res.ok || !data.src) throw new Error(data.error ?? `Upload failed (${res.status}).`);
  return data.src;
}

/**
 * Uploads the image files and inserts them at `pos`, in order. A block
 * image dropped inside a paragraph splits it (replaceRangeWith). The
 * position is only clamped, not mapped, if the document shrank while an
 * upload was in flight. Resolves the first error message, or null.
 */
export async function insertImageFiles(view: EditorView, files: File[], pos: number): Promise<string | null> {
  const images = files.filter(isAcceptedImage);
  if (images.length === 0) return files.length > 0 ? "Only PNG, JPEG and WebP images can be added." : null;
  let at = pos;
  for (const file of images) {
    let src: string;
    try {
      src = await uploadArticleImage(file);
    } catch (err) {
      return err instanceof Error ? err.message : "Upload failed.";
    }
    if (view.isDestroyed) return null;
    const { state } = view;
    const target = Math.min(at, state.doc.content.size);
    const tr = state.tr.replaceRangeWith(target, target, state.schema.nodes.image.create({ src }));
    view.dispatch(tr);
    at = tr.mapping.map(target);
  }
  return null;
}

/** Image files carried by a drag or paste, if any. */
export function imageFilesOf(data: DataTransfer | null): File[] {
  return data ? Array.from(data.files).filter((f) => f.type.startsWith("image/")) : [];
}
