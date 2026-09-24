import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { articleImagePath } from "@/server/assets/article-image-upload";
import { ARTICLE_IMAGE_KEY } from "@/server/documents/rich-attrs";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!ARTICLE_IMAGE_KEY.test(key)) return NextResponse.json({ error: "Invalid image key." }, { status: 400 });
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
    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  }
}
