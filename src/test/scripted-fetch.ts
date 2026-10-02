// Skript-Fetch: liefert je angefragter URL eine Antwort-Attrappe. Hosts sind
// IP-Literale, damit dns.lookup ohne Netz auflöst.
export type FetchStub = {
  status?: number;
  location?: string;
  body?: string | Uint8Array;
};

export const scriptedFetch = (
  handler: (url: string) => FetchStub,
): typeof fetch =>
  (async (input: URL | RequestInfo) => {
    const s = handler(String(input));
    const status = s.status ?? 200;
    const body =
      typeof s.body === "string" || s.body === undefined
        ? new TextEncoder().encode(s.body ?? "")
        : s.body;
    return {
      status,
      ok: status < 400,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "location" ? (s.location ?? null) : null,
      },
      arrayBuffer: async () => body.slice().buffer,
    };
  }) as unknown as typeof fetch;
