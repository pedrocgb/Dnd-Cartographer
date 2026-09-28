import { NextResponse } from "next/server";
import { ensureDefaultWorld } from "@/server/world/default-world";
import { searchMentions } from "@/server/mentions/store";

/** What `@q` could mention: articles, plus the campaign's quests, fronts and outline items (`campaignId`). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 60);
  const campaignId = url.searchParams.get("campaignId");
  const options = await searchMentions(await ensureDefaultWorld(), q, campaignId && campaignId.length <= 64 ? campaignId : null);
  return NextResponse.json({ options });
}
