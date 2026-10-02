type Listener = () => void;

/**
 * Prozessinterner Event-Bus je Einsatz. In v1 läuft eine Container-Instanz,
 * daher genügt ein In-Process-Pub/Sub ohne externen Broker. Signalisiert nur
 * „Einsatz X hat sich geändert"; der Client lädt daraufhin den vollen Zustand.
 *
 * An globalThis gepinnt: im Next-Dev-Modus werden Server-Module teils mehrfach
 * evaluiert (getrennte Bundles je Route/Server-Action). Ohne gemeinsame Registry
 * landen Publisher (Mutation) und Abonnent (z. B. die Geräte-SSE-Route) auf
 * verschiedenen Maps, sodass Ereignisse Abonnenten anderer Routen nicht
 * erreichen. In Produktion (eine Instanz) ist es ohnehin ein Singleton.
 */
const globalForEvents = globalThis as unknown as {
  __einsatzOperationListeners?: Map<string, Set<Listener>>;
  __einsatzOperationWindows?: Map<string, CoalescingWindow>;
};
globalForEvents.__einsatzOperationListeners ??= new Map<
  string,
  Set<Listener>
>();
globalForEvents.__einsatzOperationWindows ??= new Map<
  string,
  CoalescingWindow
>();
const listenersByOperation = globalForEvents.__einsatzOperationListeners;
const windowsByOperation = globalForEvents.__einsatzOperationWindows;

/**
 * Mindestabstand zweier Benachrichtigungen desselben Einsatzes. Über 500 ms,
 * damit keine Sekunde drei davon enthält; unter 1 s, damit die letzte Änderung
 * samt Neuladen des Clients binnen einer Sekunde ankommt.
 */
const COALESCE_MS = 600;

type CoalescingWindow = { pending: boolean };

export function subscribeOperation(
  operationId: string,
  listener: Listener,
): () => void {
  let listeners = listenersByOperation.get(operationId);
  if (!listeners) {
    listeners = new Set();
    listenersByOperation.set(operationId, listeners);
  }
  const set = listeners;
  set.add(listener);
  return () => {
    set.delete(listener);
    if (set.size === 0) listenersByOperation.delete(operationId);
  };
}

/**
 * Meldet „Einsatz X hat sich geändert". Ein ruhender Einsatz benachrichtigt
 * sofort und öffnet ein Fenster von {@link COALESCE_MS}; Änderungen darin werden
 * gesammelt und zum Fensterende einmal gemeldet, das wieder ein Fenster öffnet.
 */
export function publishOperationChanged(operationId: string): void {
  const coalescing = windowsByOperation.get(operationId);
  if (coalescing) {
    coalescing.pending = true;
    return;
  }
  const listeners = listenersByOperation.get(operationId);
  if (!listeners) return;
  notifyAll(listeners);
  openWindow(operationId);
}

function openWindow(operationId: string): void {
  const coalescing: CoalescingWindow = { pending: false };
  windowsByOperation.set(operationId, coalescing);
  setTimeout(() => {
    windowsByOperation.delete(operationId);
    if (coalescing.pending) publishOperationChanged(operationId);
  }, COALESCE_MS);
}

function notifyAll(listeners: Set<Listener>): void {
  listeners.forEach((listener) => {
    // Ein kaputter Abonnent (z. B. geschlossener Stream) darf weder die übrigen
    // Abonnenten noch die auslösende Mutation scheitern lassen.
    try {
      listener();
    } catch {
      // ignorieren; der Stream räumt sich beim nächsten cancel selbst ab
    }
  });
}
