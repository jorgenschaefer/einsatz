/**
 * Liest den Request-Body höchstens bis `maxBytes` – auch ohne
 * `Content-Length`. Route Handler unterliegen weder dem
 * `bodySizeLimit` der Server Actions noch dem Proxy und müssen ihren Body
 * deshalb selbst begrenzen.
 */
export async function readRequestBody(
  request: Request,
  maxBytes: number,
): Promise<Uint8Array<ArrayBuffer>> {
  if (Number(request.headers.get("content-length")) > maxBytes) {
    throw new RequestBodyTooLargeError(maxBytes);
  }
  if (!request.body) return new Uint8Array(0);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > maxBytes) {
      await reader.cancel();
      throw new RequestBodyTooLargeError(maxBytes);
    }
    chunks.push(value);
  }
  return concat(chunks, length);
}

export class RequestBodyTooLargeError extends Error {
  constructor(maxBytes: number) {
    super(`Request body exceeds ${maxBytes} bytes`);
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
