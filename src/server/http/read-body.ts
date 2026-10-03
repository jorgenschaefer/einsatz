/**
 * Liest den Body einer Anfrage oder Antwort höchstens bis `maxBytes` – auch
 * ohne `Content-Length`; ein angekündigtes Zuviel lehnt es ab, ohne zu lesen.
 * Route Handler unterliegen weder dem `bodySizeLimit` der Server Actions noch
 * dem Proxy und müssen ihren Body deshalb selbst begrenzen; der KML-Abruf
 * begrenzt so die Antworten fremder Server. `onRead` erfährt die Größe jedes
 * gelesenen Stücks, auch des einen, das die Grenze überschreitet.
 */
export async function readBody(
  message: Request | Response,
  maxBytes: number,
  onRead?: (bytes: number) => void,
): Promise<Uint8Array<ArrayBuffer>> {
  if (Number(message.headers.get("content-length")) > maxBytes) {
    await message.body?.cancel();
    throw new BodyTooLargeError(maxBytes);
  }
  if (!message.body) return new Uint8Array(0);

  const reader = message.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    onRead?.(value.length);
    if (length > maxBytes) {
      await reader.cancel();
      throw new BodyTooLargeError(maxBytes);
    }
    chunks.push(value);
  }
  return concat(chunks, length);
}

export class BodyTooLargeError extends Error {
  constructor(maxBytes: number) {
    super(`Body exceeds ${maxBytes} bytes`);
  }
}

function concat(chunks: Uint8Array[], length: number): Uint8Array<ArrayBuffer> {
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.length;
  }
  return body;
}
