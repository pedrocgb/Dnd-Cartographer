import { getSettings } from "@/server/settings/store";
import { createTranslator, type Translator } from "./translate";
import type { Namespace } from "./messages";
import type { Locale } from "./config";

/** The language setting, read fresh: for server components, API routes and server modules. */
export async function serverLocale(): Promise<Locale> {
  return (await getSettings()).language;
}

/** `t()` for a namespace in the user's language, on the server. */
export async function serverT<N extends Namespace>(ns: N): Promise<Translator<N>> {
  return createTranslator(await serverLocale(), ns);
}
