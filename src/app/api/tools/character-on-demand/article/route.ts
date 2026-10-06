import { NextResponse } from "next/server";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { MAX_INFO_TEXT_LENGTH, sanitizeInfo } from "@/server/articles/info-fields";
import { personInfoSet } from "@/server/articles/info-sets";
import { buildCharacterDocument, type DetailLine } from "@/server/character-on-demand/document";
import { createDocument } from "@/server/documents/create";
import { db } from "@/server/db/client";
import { people } from "@/server/db/schema";
import { requireWorldId } from "@/server/world/active-world";
import type { Backstory } from "@/lib/character-on-demand/backstory";
import { HISTORY_MAX } from "@/lib/character-on-demand/history";
import { BACKGROUNDS, BEARDS, FEMALE_HAIRSTYLES, GENDERS, MALE_HAIRSTYLES, SPECIES, hairColorsFor } from "@/lib/character-on-demand/options";

const MAX_NAME = 200;
const MAX_BACKSTORY_LINE = 400;
const BACKSTORY_KEYS = ["appearance", "want", "quirk", "fear", "secret"] as const satisfies readonly (keyof Backstory)[];

/** `value` if it's one of `allowed`, else undefined. */
function oneOf<T extends string>(allowed: readonly T[], value: unknown): T | undefined {
  return allowed.includes(value as T) ? (value as T) : undefined;
}

/** The backstory's lines (each a short non-empty string), null when absent, false when malformed. */
function readBackstory(raw: unknown): Backstory | null | false {
  if (raw == null) return null;
  if (typeof raw !== "object") return false;
  const entries = BACKSTORY_KEYS.map((key) => [key, (raw as Record<string, unknown>)[key]] as const);
  const valid = entries.every(([, v]) => typeof v === "string" && v.trim() && v.length <= MAX_BACKSTORY_LINE);
  return valid ? (Object.fromEntries(entries.map(([k, v]) => [k, (v as string).trim()])) as unknown as Backstory) : false;
}

/**
 * Creates a Character article from a Character On Demand result: name and the
 * Gender, Hair, Social Background, Ambitions and Fears fields, plus the
 * details and backstory in its body. Except for the name and the backstory's
 * text, every value must come from the tool's own lists.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name || name.length > MAX_NAME) return NextResponse.json({ error: "A name of up to 200 characters is required." }, { status: 400 });

  const gender = oneOf(GENDERS, body?.gender);
  const species = SPECIES.find((s) => s.key === body?.species);
  if (!gender || !species) return NextResponse.json({ error: "Unknown gender or species." }, { status: 400 });

  const optional = (value: unknown, allowed: readonly string[]) => (value == null ? null : (oneOf(allowed, value) ?? false));
  const background = optional(body?.background, BACKGROUNDS);
  const hairstyle = optional(body?.hairstyle, gender === "Male" ? MALE_HAIRSTYLES : FEMALE_HAIRSTYLES);
  const hairColor = optional(body?.hairColor, hairColorsFor(species.key));
  const beard = optional(body?.beard, BEARDS);
  if (background === false || hairstyle === false || hairColor === false || beard === false) {
    return NextResponse.json({ error: "Unknown background, hair or beard." }, { status: 400 });
  }
  const backstory = readBackstory(body?.backstory);
  if (backstory === false) return NextResponse.json({ error: "Invalid backstory." }, { status: 400 });

  const hair = [hairstyle, hairColor?.toLowerCase()].filter(Boolean).join(", ");
  const details: DetailLine[] = [
    { label: "Species", value: species.label },
    { label: "Gender", value: gender },
    ...(background ? [{ label: "Background", value: background }] : []),
    ...(hair ? [{ label: "Hair", value: hair }] : []),
    ...(beard ? [{ label: "Beard", value: beard }] : []),
  ];
  // A field longer than its limit would be cut mid-sentence: such a line stays in the body only.
  const fits = (line: string | undefined) => (line && line.length <= MAX_INFO_TEXT_LENGTH ? line : undefined);
  const ambitions = fits(backstory?.want);
  const fears = fits(backstory?.fear);
  const info =
    sanitizeInfo(personInfoSet("npc"), {
      gender,
      ...(hair && { hair }),
      ...(background && { socialBackground: background }),
      ...(ambitions && { ambitions }),
      ...(fears && { fears }),
    }) ?? {};

  const worldId = await requireWorldId();
  const person = await db.transaction(async (tx) => {
    const doc = await createDocument(worldId, buildCharacterDocument(details, backstory), tx);
    const [created] = await tx
      .insert(people)
      .values({ worldId, name, kind: "npc", descriptionDocumentId: doc.id, info: JSON.stringify(info) })
      .returning();
    return created;
  });
  return NextResponse.json({ person }, { status: 201 });
}

/** `?ids=a,b`: which of these Character articles still exist (not deleted or in the trash), for the history. */
export async function GET(request: Request) {
  const ids = [...new Set((new URL(request.url).searchParams.get("ids") ?? "").split(",").filter(Boolean))];
  if (ids.length > HISTORY_MAX) return NextResponse.json({ error: `At most ${HISTORY_MAX} ids.` }, { status: 400 });
  if (!ids.length) return NextResponse.json({ ids: [] });

  const worldId = await requireWorldId();
  const rows = await db
    .select({ id: people.id })
    .from(people)
    .where(and(eq(people.worldId, worldId), inArray(people.id, ids), isNull(people.deletedAt)));
  return NextResponse.json({ ids: rows.map((r) => r.id) });
}
