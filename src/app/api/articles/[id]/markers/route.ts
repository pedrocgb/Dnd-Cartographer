import { NextResponse } from "next/server";
import { markersOfArticle } from "@/server/markers/article-links";

/** Every live marker linked to this article (any template), primary links first — the "On the map" section. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.json({ markers: await markersOfArticle(id) });
}
