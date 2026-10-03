import type { pinnedFetch } from "@/server/kml/pinned-fetch";

// Skript-Fetch: liefert je angefragter URL eine echte `Response`, als Ersatz
// für `pinnedFetch` in Tests (`vi.mock("@/server/kml/pinned-fetch")`).
export type FetchStub = {
  status?: number;
  location?: string;
  body?: string | Uint8Array | ReadableStream<Uint8Array>;
};

export const scriptedFetch =
  (handler: (url: string) => FetchStub): typeof pinnedFetch =>
  async (url) => {
    const s = handler(String(url));
    const headers = new Headers();
    if (s.location) headers.set("location", s.location);
    return new Response(responseBody(s.body), {
      status: s.status ?? 200,
      headers,
    });
  };

const responseBody = (body: FetchStub["body"]): BodyInit => {
  if (body instanceof ReadableStream) return body;
  if (typeof body === "string" || body === undefined)
    return new TextEncoder().encode(body ?? "");
  return new Uint8Array(body);
};

/**
 * Ein Body, der erst beim Lesen entsteht: `start`, dann Leerzeichen bis
 * `totalBytes` (ohne Angabe endlos). `pulled()` zählt die gelesenen Bytes,
 * `cancelled()` meldet, ob der Leser abgebrochen hat.
 */
export function generatedBody({
  start = "",
  totalBytes = Number.POSITIVE_INFINITY,
  chunkBytes = 64 * 1024,
}: {
  start?: string;
  totalBytes?: number;
  chunkBytes?: number;
}): {
  stream: ReadableStream<Uint8Array>;
  pulled: () => number;
  cancelled: () => boolean;
} {
  let pulled = 0;
  let cancelled = false;
  const head = new TextEncoder().encode(start);
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        const size = Math.min(chunkBytes, totalBytes - pulled);
        if (size <= 0) return controller.close();
        const chunk = new Uint8Array(size).fill(0x20);
        if (pulled < head.length)
          chunk.set(head.subarray(pulled, pulled + size));
        pulled += size;
        controller.enqueue(chunk);
      },
      cancel() {
        cancelled = true;
      },
    },
    { highWaterMark: 0 },
  );
  return { stream, pulled: () => pulled, cancelled: () => cancelled };
}
