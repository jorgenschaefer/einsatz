import type { pinnedFetch } from "@/server/kml/pinned-fetch";

// Skript-Fetch: liefert je angefragter URL eine echte `Response`, als Ersatz
// für `pinnedFetch` in Tests (`vi.mock("@/server/kml/pinned-fetch")`).
export type FetchStub = {
  status?: number;
  location?: string;
  body?: string | Uint8Array;
};

export const scriptedFetch =
  (handler: (url: string) => FetchStub): typeof pinnedFetch =>
  async (url) => {
    const s = handler(String(url));
    const headers = new Headers();
    if (s.location) headers.set("location", s.location);
    const body =
      typeof s.body === "string" || s.body === undefined
        ? new TextEncoder().encode(s.body ?? "")
        : s.body;
    return new Response(new Uint8Array(body), {
      status: s.status ?? 200,
      headers,
    });
  };
