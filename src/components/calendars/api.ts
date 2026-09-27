/** Tiny JSON fetch wrapper: never throws on HTTP errors, returns the body with `ok`/`status`. */
export async function api<T = Record<string, unknown>>(method: string, url: string, body?: unknown): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "Could not reach the server." } as T & { error?: string } };
  }
}

/** A short random id for new definition items (stable once saved). */
export const newId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
