import { vi } from "vitest";

const DESKTOP_QUERY = "(min-width: 48em)";

/**
 * Stubbt `window.matchMedia` mit einem `matches`-Wert für die Desktop-Query
 * (48 em), der sich über `fireChange` ändern lässt – wie ein echter
 * `MediaQueryList` ruft das die per `addEventListener("change", …)` auf dieser
 * Query registrierten Listener auf. Mantine ruft `matchMedia` für andere
 * Queries auf (Farbschema u. Ä.); die liefern nie einen Treffer. Mit
 * `vi.unstubAllGlobals()` wieder entfernen.
 */
export function stubMatchMedia(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<(event: { matches: boolean }) => void>();
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      get matches() {
        return query === DESKTOP_QUERY ? matches : false;
      },
      media: query,
      onchange: null,
      addEventListener: (
        event: string,
        cb: (e: { matches: boolean }) => void,
      ) => {
        if (event === "change" && query === DESKTOP_QUERY) listeners.add(cb);
      },
      removeEventListener: (
        event: string,
        cb: (e: { matches: boolean }) => void,
      ) => {
        if (event === "change") listeners.delete(cb);
      },
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
  return {
    fireChange: (nextMatches: boolean) => {
      matches = nextMatches;
      for (const listener of listeners) listener({ matches: nextMatches });
    },
    listenerCount: () => listeners.size,
  };
}
