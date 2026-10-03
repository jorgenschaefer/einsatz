/**
 * Baut einen SSE-Response, der bei jedem Bus-Ereignis „changed" sendet.
 * `subscribe` abonniert den Bus und liefert die Abmeldung zurück. Bei jedem
 * Heartbeat prüft der Strom mit `stillAllowed`, ob der Zugang noch besteht, und
 * endet sonst; spätestens nach einer Stunde endet er ohnehin (EventSource
 * verbindet neu und prüft dabei den Zugang wie beim ersten Öffnen). `onClose`
 * läuft genau einmal, wie auch immer der Strom endet. Dünne Streaming-Grenze.
 */
/** Halt-am-Leben-Intervall, damit Reverse-Proxies den ruhenden Strom nicht kappen. */
const HEARTBEAT_MS = 25_000;
const MAX_STREAM_MS = 60 * 60_000;

export function operationEventStream({
  subscribe,
  stillAllowed,
  onClose,
}: {
  subscribe: (notify: () => void) => () => void;
  stillAllowed: () => Promise<boolean>;
  onClose: () => void;
}): Response {
  const encoder = new TextEncoder();
  const openedAt = Date.now();
  let unsubscribe: (() => void) | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let torndown = false;

  // Ein einziger, idempotenter Abbau – aufgerufen bei cancel(), beim Beenden
  // durch den Server UND wenn ein enqueue in einen bereits toten Controller
  // läuft. So bleibt kein Heartbeat zurück, wenn die Verbindung ohne cancel()
  // abbricht.
  const cleanup = () => {
    if (torndown) return;
    torndown = true;
    if (heartbeat) clearInterval(heartbeat);
    unsubscribe?.();
    onClose();
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
      const end = () => {
        cleanup();
        controller.close();
      };
      const tick = async () => {
        if (Date.now() - openedAt + HEARTBEAT_MS > MAX_STREAM_MS) return end();
        const allowed = await stillAllowed().catch(() => false);
        if (torndown) return;
        if (!allowed) return end();
        enqueue(": ping\n\n");
      };
      enqueue(": connected\n\n");
      // Scheiterte schon die Preamble, ist der Controller tot: nichts mehr
      // aufsetzen, sonst entstünden Abo/Heartbeat nach dem Abbau (Leck).
      if (torndown) return;
      unsubscribe = subscribe(() => enqueue("data: changed\n\n"));
      heartbeat = setInterval(tick, HEARTBEAT_MS);
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
