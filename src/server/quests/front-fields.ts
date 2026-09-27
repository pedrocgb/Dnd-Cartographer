import type { fronts } from "@/server/db/schema";
import { cleanColor } from "@/server/calendars/parse";
import { parseClock, parseFrontKind, parseFrontName, parseFrontStatus, parseFrontText, parsePortents, parseSortOrder } from "./parse";

type FrontPatch = Partial<typeof fronts.$inferInsert>;

/** The front fields present in a create/edit body, validated. */
export function frontFields(body: Record<string, unknown>): FrontPatch {
  const patch: FrontPatch = {};
  if ("name" in body) patch.name = parseFrontName(body.name);
  if ("kind" in body) patch.kind = parseFrontKind(body.kind);
  if ("status" in body) patch.status = parseFrontStatus(body.status);
  if ("threat" in body) patch.threat = parseFrontText(body.threat, "The threat");
  if ("doom" in body) patch.doom = parseFrontText(body.doom, "The impending doom");
  if ("portents" in body) patch.portents = JSON.stringify(parsePortents(body.portents));
  if ("clock" in body) {
    const clock = parseClock(body.clock);
    patch.clock = clock ? JSON.stringify(clock) : null;
  }
  if ("clockPerPortent" in body) patch.clockPerPortent = body.clockPerPortent === true;
  if ("color" in body) patch.color = body.color === null ? null : cleanColor(body.color);
  if ("sortOrder" in body) patch.sortOrder = parseSortOrder(body.sortOrder);
  return patch;
}
