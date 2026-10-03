import { describe, expect, it } from "vitest";
import { generatedBody, scriptedFetch } from "./scripted-fetch";

describe("generatedBody", () => {
  it("counts exactly the bytes a reader pulled from an endless body", async () => {
    const body = generatedBody({ chunkBytes: 1000 });
    const reader = body.stream.getReader();

    let read = 0;
    for (let i = 0; i < 3; i++)
      read += (await reader.read()).value?.length ?? 0;
    await reader.cancel();

    expect(read).toBe(3000);
    expect(body.pulled()).toBe(3000);
  });

  it("starts with the given text and ends after the given size", async () => {
    const body = generatedBody({ start: "<kml>", totalBytes: 2500 });

    const text = await new Response(body.stream).text();

    expect(text.startsWith("<kml>")).toBe(true);
    expect(text).toHaveLength(2500);
    expect(body.pulled()).toBe(2500);
  });

  it("is served by scriptedFetch as a response body", async () => {
    const body = generatedBody({ start: "<kml/>", totalBytes: 6 });
    const fetch = scriptedFetch(() => ({ body: body.stream }));

    const response = await fetch(new URL("http://93.184.216.34/x.kml"), {
      headers: {},
      signal: AbortSignal.timeout(1000),
    });

    expect(await response.text()).toBe("<kml/>");
  });
});
