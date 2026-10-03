import { describe, expect, it } from "vitest";
import { RequestBodyTooLargeError, readRequestBody } from "./request-body";

const bytes = (n: number) => new Uint8Array(n).fill(0x20);

const streamOf = (...chunks: Uint8Array[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });

const requestWith = (
  body: ReadableStream<Uint8Array> | null,
  headers?: HeadersInit,
) =>
  new Request("http://localhost/", {
    method: "POST",
    body,
    headers,
    duplex: "half",
  } as RequestInit);

describe("readRequestBody", () => {
  it("returns a body of exactly maxBytes, across chunks", async () => {
    const body = await readRequestBody(
      requestWith(streamOf(bytes(6), bytes(4))),
      10,
    );
    expect(body).toEqual(bytes(10));
  });

  it("rejects a body one byte over maxBytes", async () => {
    await expect(
      readRequestBody(requestWith(streamOf(bytes(6), bytes(5))), 10),
    ).rejects.toBeInstanceOf(RequestBodyTooLargeError);
  });

  it("rejects an announced Content-Length over maxBytes without reading", async () => {
    let pulls = 0;
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          pulls++;
          controller.enqueue(bytes(1));
          controller.close();
        },
      },
      { highWaterMark: 0 },
    );

    await expect(
      readRequestBody(requestWith(body, { "content-length": "11" }), 10),
    ).rejects.toBeInstanceOf(RequestBodyTooLargeError);
    expect(pulls).toBe(0);
  });

  it("cancels an endless stream once it passes maxBytes", async () => {
    let cancelled = false;
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(bytes(4));
      },
      cancel() {
        cancelled = true;
      },
    });

    await expect(
      readRequestBody(requestWith(endless), 10),
    ).rejects.toBeInstanceOf(RequestBodyTooLargeError);
    expect(cancelled).toBe(true);
  });

  it("returns empty bytes for a request without a body", async () => {
    const body = await readRequestBody(requestWith(null), 10);
    expect(body).toEqual(new Uint8Array(0));
  });

  it("names the limit in its error", async () => {
    await expect(
      readRequestBody(requestWith(streamOf(bytes(11))), 10),
    ).rejects.toThrow("10 bytes");
  });
});
