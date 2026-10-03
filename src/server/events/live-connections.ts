/**
 * Zählt offene Live-Verbindungen je Schlüssel (Nutzer, Gerätelink,
 * Ansichtslink). Wie der Event-Bus an globalThis gepinnt, damit alle Routen
 * desselben Prozesses dieselben Zähler sehen.
 */
const globalForLiveConnections = globalThis as unknown as {
  __einsatzLiveConnections?: Map<string, number>;
};
globalForLiveConnections.__einsatzLiveConnections ??= new Map<string, number>();
const openByKey = globalForLiveConnections.__einsatzLiveConnections;

/**
 * Belegt einen Platz für eine Live-Verbindung unter `key`, oder liefert null,
 * wenn dort schon `limit` offen sind. Die zurückgegebene Freigabe ist
 * idempotent.
 */
export function openLiveConnection(
  key: string,
  limit: number,
): (() => void) | null {
  const open = openByKey.get(key) ?? 0;
  if (open >= limit) return null;
  openByKey.set(key, open + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const remaining = (openByKey.get(key) ?? 1) - 1;
    if (remaining === 0) openByKey.delete(key);
    else openByKey.set(key, remaining);
  };
}
