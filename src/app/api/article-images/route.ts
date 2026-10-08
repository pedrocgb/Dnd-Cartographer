import { NextResponse } from "next/server";
import { errorResponse } from "@/i18n/server";
import { processArticleImageUpload } from "@/server/assets/article-image-upload";
import { InvalidImageError } from "@/server/assets/validate";
import { ARTICLE_IMAGE_URL_PREFIX } from "@/server/documents/rich-attrs";

export const runtime = "nodejs";

/** Raw image body (PNG, JPEG or WebP) → `{ src }` to place in a rich-text document. */
export async function POST(request: Request) {
  if (!request.body) return errorResponse("imageEmpty", 400);
  try {
    const key = await processArticleImageUpload(request.body);
    return NextResponse.json({ src: `${ARTICLE_IMAGE_URL_PREFIX}${key}` }, { status: 201 });
  } catch (err) {
    if (err instanceof InvalidImageError) return errorResponse(err.key, 400, undefined, err.params);
    throw err;
  }
}
