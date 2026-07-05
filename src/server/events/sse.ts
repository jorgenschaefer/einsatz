/**
 * Baut einen SSE-Response, der bei jedem Bus-Ereignis „changed" sendet. Der
 * Übergabeparameter abonniert den Bus und liefert die Abmeldung zurück, die beim
 * Verbindungsabbruch (stream cancel) aufgerufen wird. Dünne Streaming-Grenze.
 */
/** Halt-am-Leben-Intervall, damit Reverse-Proxies den ruhenden Strom nicht kappen. */
const HEARTBEAT_MS = 25_000;

export function operationEventStream(
  subscribe: (notify: () => void) => () => void,
): Response {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let torndown = false;

  // Ein einziger, idempotenter Abbau – aufgerufen bei cancel() UND wenn ein
  // enqueue in einen bereits toten Controller läuft. So bleibt kein Heartbeat
  // zurück, wenn die Verbindung ohne cancel() abbricht.
  const cleanup = () => {
    if (torndown) return;
    torndown = true;
    if (heartbeat) clearInterval(heartbeat);
    unsubscribe?.();
  };

  const stream = new ReadableStream({
    start(controller) {
      const enqueue = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup(); // Controller bereits geschlossen → alles abbauen
        }
      };
      enqueue(": connected\n\n");
      // Scheiterte schon die Preamble, ist der Controller tot: nichts mehr
      // aufsetzen, sonst entstünden Abo/Heartbeat nach dem Abbau (Leck).
      if (torndown) return;
      unsubscribe = subscribe(() => enqueue("data: changed\n\n"));
      heartbeat = setInterval(() => enqueue(": ping\n\n"), HEARTBEAT_MS);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
