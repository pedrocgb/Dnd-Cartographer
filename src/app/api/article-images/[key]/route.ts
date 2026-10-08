import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { articleImagePath } from "@/server/assets/article-image-upload";
import { ARTICLE_IMAGE_KEY } from "@/server/documents/rich-attrs";
import { errorResponse } from "@/i18n/server";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!ARTICLE_IMAGE_KEY.test(key)) return errorResponse("imageKeyInvalid", 400);
  try {
    const data = await readFile(articleImagePath(key));
    return new NextResponse(data, {
      headers: {
        "Content-Type": "image/webp",
        // Keys are never reused, so the bytes behind a URL never change.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return errorResponse("imageNotFound", 404);
  }
}
