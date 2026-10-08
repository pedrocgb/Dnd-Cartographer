import { activeT } from "@/i18n/active";

/** Tiny JSON fetch wrapper: never throws on HTTP errors, returns the body with `ok`/`status`. */
export async function api<T = Record<string, unknown>>(method: string, url: string, body?: unknown): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string; noWorld?: boolean };
    // No world open in this browser (src/proxy.ts): back to the worlds screen, a full load (no router in a plain helper).
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    if (res.status === 409 && data.noWorld) window.location.assign("/worlds");
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: activeT("common")("serverUnreachable") } as T & { error?: string } };
  }
}

/** Tells the top bar's in-world date to reload (after the current day or a calendar changed). */
export const WORLD_DATE_EVENT = "world-date-changed";
export const notifyWorldDateChanged = () => window.dispatchEvent(new Event(WORLD_DATE_EVENT));

/** A short random id for new definition items (stable once saved). */
export const newId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
