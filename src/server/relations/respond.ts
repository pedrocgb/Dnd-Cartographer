import { errorResponse, serverLocale } from "@/i18n/server";
import { relationTypeName, type RelationError } from "./store";

/** A relation validation error as a 409 in the user's language, the relation type named in it too. */
export async function relationErrorResponse(err: RelationError) {
  const locale = await serverLocale();
  const params = err.params?.type ? { ...err.params, type: relationTypeName(err.params.type, locale) } : err.params;
  return errorResponse(err.key, 409, undefined, params);
}
