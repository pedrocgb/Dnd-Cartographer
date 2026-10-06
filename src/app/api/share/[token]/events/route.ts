import { NextResponse } from "next/server";
import { shareFingerprint } from "@/server/share/load";

export const runtime = "nodejs";

/** How often the stream checks the shared content, and how often it sends a keep-alive when nothing changed. */
const POLL_MS = 1500;
const KEEPALIVE_MS = 15_000;

/**
 * Public: a server-sent event stream for an open shared page. "change" when
 * anything the view is built from changed (the page refetches it), "gone"
 * once the link is revoked or its target deleted. One cheap stamp query per
 * tick and viewer, no document parsing.
 */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let last = await shareFingerprint(token);
  if (last === null) return NextResponse.json({ error: "This link is no longer available." }, { status: 404 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let checking = false;
      let quietSince = Date.now();
      const write = (chunk: string) => {
        if (!closed) controller.enqueue(encoder.encode(chunk));
      };
      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(timer);
        try {
          controller.close();
        } catch {
          // Already closed by the client going away.
        }
      };
      const timer = setInterval(async () => {
        if (checking || closed) return;
        checking = true;
        try {
          const now = await shareFingerprint(token);
          if (now === null) {
            write("event: gone\ndata: \n\n");
            close();
          } else if (now !== last) {
            last = now;
            quietSince = Date.now();
            write("event: change\ndata: \n\n");
          } else if (Date.now() - quietSince >= KEEPALIVE_MS) {
            quietSince = Date.now();
            write(": keep-alive\n\n");
          }
        } catch {
          // A failed check (busy database) is retried on the next tick.
        } finally {
          checking = false;
        }
      }, POLL_MS);
      request.signal.addEventListener("abort", close);
      write("retry: 3000\n\n");
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  });
}
