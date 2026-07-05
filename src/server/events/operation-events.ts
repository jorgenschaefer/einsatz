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
};
globalForEvents.__einsatzOperationListeners ??= new Map<
  string,
  Set<Listener>
>();
const listenersByOperation = globalForEvents.__einsatzOperationListeners;

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

export function publishOperationChanged(operationId: string): void {
  listenersByOperation.get(operationId)?.forEach((listener) => {
    // Ein kaputter Abonnent (z. B. geschlossener Stream) darf weder die übrigen
    // Abonnenten noch die auslösende Mutation scheitern lassen.
    try {
      listener();
    } catch {
      // ignorieren; der Stream räumt sich beim nächsten cancel selbst ab
    }
  });
}
