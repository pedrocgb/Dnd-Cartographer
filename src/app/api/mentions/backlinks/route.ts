import { NextResponse } from "next/server";
import { badRequest } from "@/server/calendars/respond";
import { backlinksTo } from "@/server/mentions/store";
import { MENTION_ID } from "@/server/mentions/kinds";

/** The pages whose text @mentions `id`. */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!MENTION_ID.test(id)) return badRequest("Pass the id of what was mentioned.");
  return NextResponse.json({ backlinks: await backlinksTo(id) });
}
