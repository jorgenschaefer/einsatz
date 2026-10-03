/**
 * Ein Upload-Request wie aus dem Browser: `multipart/form-data`, als Stream
 * und ohne `Content-Length`, damit die Route ihr eigenes Limit beim Lesen
 * durchsetzen muss. Von Hand kodiert, weil unter jsdom `FormData` und `File`
 * aus jsdom stammen, die Nodes `Response` nicht kodieren kann.
 */
export async function multipartRequest(
  method: "POST" | "PUT",
  form: FormData,
  headers: Record<string, string> = {},
): Promise<Request> {
  const boundary = "----einsatz-test-boundary";
  const parts: Uint8Array[] = [];
  for (const [name, value] of form) {
    parts.push(...(await encodePart(boundary, name, value)));
  }
  parts.push(encoder.encode(`--${boundary}--\r\n`));
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const part of parts) controller.enqueue(part);
      controller.close();
    },
  });
  return streamedRequest(method, body, {
    "content-type": `multipart/form-data; boundary=${boundary}`,
    ...headers,
  });
}

export function streamedRequest(
  method: "POST" | "PUT",
  body: ReadableStream<Uint8Array>,
  headers: Record<string, string> = {},
): Request {
  return new Request("http://localhost/", {
    method,
    body,
    headers: { "content-type": "multipart/form-data; boundary=x", ...headers },
    duplex: "half",
  } as RequestInit);
}

export const routeParams = <T>(value: T) => ({
  params: Promise.resolve(value),
});

const encoder = new TextEncoder();

async function encodePart(
  boundary: string,
  name: string,
  value: FormDataEntryValue,
): Promise<Uint8Array[]> {
  const isFile = typeof value !== "string";
  const head =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="${name}"` +
    (isFile
      ? `; filename="${value.name}"\r\nContent-Type: ${value.type || "application/octet-stream"}\r\n\r\n`
      : "\r\n\r\n");
  const content = isFile
    ? new Uint8Array(await value.arrayBuffer())
    : encoder.encode(value);
  return [encoder.encode(head), content, encoder.encode("\r\n")];
}
