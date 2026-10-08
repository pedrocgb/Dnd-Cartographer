import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { articleImagePath } from "@/server/assets/article-image-upload";
import { ARTICLE_IMAGE_KEY } from "@/server/documents/rich-attrs";
import { loadShare } from "@/server/share/load";
import { errorResponse } from "@/i18n/server";

export const runtime = "nodejs";

/** Public: an image the shared view shows, and no other. */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string; key: string }> }) {
  const { token, key } = await params;
  if (!ARTICLE_IMAGE_KEY.test(key)) return errorResponse("imageKeyInvalid", 400);
  const share = await loadShare(token);
  if (!share?.imageKeys.has(key)) return errorResponse("imageNotFound", 404);
  try {
    return new NextResponse(await readFile(articleImagePath(key)), { headers: { "Content-Type": "image/webp", "Cache-Control": "private, max-age=300" } });
  } catch {
    return errorResponse("imageNotFound", 404);
  }
}
