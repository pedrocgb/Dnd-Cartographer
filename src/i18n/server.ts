import { NextResponse } from "next/server";
import { getSettings } from "@/server/settings/store";
import { formatDecimal } from "@/server/settings/number-format";
import { createTranslator, type TranslateParams, type Translator } from "./translate";
import type { MessageKey, Namespace } from "./messages";
import type { Locale } from "./config";

/** The language setting, read fresh: for server components, API routes and server modules. */
export async function serverLocale(): Promise<Locale> {
  return (await getSettings()).language;
}

/** `t()` for a namespace in the user's language, on the server. */
export async function serverT<N extends Namespace>(ns: N): Promise<Translator<N>> {
  return createTranslator(await serverLocale(), ns);
}

/**
 * An API error reply in the user's language: `{ error, ...extra }` with
 * `status`. Numeric `params` are written in the user's number format
 * (except `count`, which picks the plural).
 */
export async function errorResponse(key: MessageKey<"errors">, status: number, extra?: Record<string, unknown>, params?: TranslateParams): Promise<NextResponse> {
  const settings = await getSettings();
  const t = createTranslator(settings.language, "errors");
  const words = params && Object.fromEntries(Object.entries(params).map(([k, v]) => [k, typeof v === "number" && k !== "count" ? formatDecimal(v, { maximumFractionDigits: 1, format: settings.numberFormat }) : v]));
  return NextResponse.json({ error: t(key, words), ...extra }, { status });
}
