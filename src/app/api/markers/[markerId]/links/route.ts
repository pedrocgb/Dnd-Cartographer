import { NextResponse } from "next/server";
import { buildMarkerLinks } from "@/server/politics/links";

export async function GET(_request: Request, { params }: { params: Promise<{ markerId: string }> }) {
  const { markerId } = await params;
  const links = await buildMarkerLinks(markerId);
  return NextResponse.json({ links });
}
