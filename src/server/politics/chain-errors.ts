import { errorResponse, serverT } from "@/i18n/server";
import type { Translator } from "@/i18n/translate";
import { territoryTypeLabel, type ChainError } from "./hierarchy-config";

/** A failed `validateChain` in the user's language, with territory types worded too. */
export async function chainErrorText({ error }: { error: ChainError }): Promise<string> {
  const [t, tp] = await Promise.all([serverT("errors"), serverT("politics")]);
  return t(error.key, chainParams(error, tp));
}

/** A failed `validateChain` as an API error reply. */
export async function chainErrorResponse({ error }: { error: ChainError }, status: number) {
  return errorResponse(error.key, status, undefined, chainParams(error, await serverT("politics")));
}

const chainParams = (error: ChainError, tp: Translator<"politics">) =>
  Object.fromEntries(Object.entries(error.params).map(([k, v]) => [k, k === "id" ? v : territoryTypeLabel(v, tp)]));
