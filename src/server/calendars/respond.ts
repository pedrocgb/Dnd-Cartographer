import { NextResponse } from "next/server";
import { ParseError } from "./parse";
import { CalendarError } from "./engine";
import { RecurrenceError } from "./recurrence";
import { StaleError } from "./store";
import { InvalidError, ReviewError } from "./mutations";

/** Maps calendar domain errors to responses (400 invalid, 409 stale / needs review); anything else rethrows. */
export function calendarErrorResponse(error: unknown) {
  if (error instanceof ReviewError) return NextResponse.json({ error: error.message, impact: error.impact, needsReview: true }, { status: 409 });
  if (error instanceof StaleError) return NextResponse.json({ error: error.message, stale: true }, { status: 409 });
  if (error instanceof ParseError || error instanceof CalendarError || error instanceof RecurrenceError || error instanceof InvalidError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  throw error;
}

export async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  const body = await request.json().catch(() => null);
  return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
}

export const badRequest = (error: string) => NextResponse.json({ error }, { status: 400 });
export const notFound = (error: string) => NextResponse.json({ error }, { status: 404 });
