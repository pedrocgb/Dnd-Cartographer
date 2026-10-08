import { NextResponse } from "next/server";
import { serverLocale } from "@/i18n/server";
import { CalendarError, problemText, type Problem } from "./engine";
import { StaleError } from "./store";
import { ReviewError } from "./mutations";

/** A calendar Problem in the user's language. */
export async function problemWords(problem: Problem): Promise<string> {
  return problemText(problem, await serverLocale());
}

/**
 * Maps calendar domain errors (ParseError, RecurrenceError, InvalidError… all
 * extend CalendarError) to responses in the user's language: 400 invalid,
 * 409 stale / needs review. Anything else rethrows.
 */
export async function calendarErrorResponse(error: unknown) {
  if (!(error instanceof CalendarError)) throw error;
  const message = error.problem ? await problemWords(error.problem) : error.message;
  if (error instanceof ReviewError) return NextResponse.json({ error: message, impact: error.impact, needsReview: true }, { status: 409 });
  if (error instanceof StaleError) return NextResponse.json({ error: message, stale: true }, { status: 409 });
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  const body = await request.json().catch(() => null);
  return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
}

export const badRequest = (error: string) => NextResponse.json({ error }, { status: 400 });
export const notFound = (error: string) => NextResponse.json({ error }, { status: 404 });
