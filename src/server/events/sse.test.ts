import { afterEach, describe, expect, it, vi } from "vitest";
import { operationEventStream } from "./sse";

afterEach(() => {
  vi.useRealTimers();
});

async function readChunk(reader: ReadableStreamDefaultReader<Uint8Array>) {
  const { value } = await reader.read();
  return new TextDecoder().decode(value);
}

describe("operationEventStream", () => {
  it("emits the connected preamble and subscribes to the bus", async () => {
    let notify: (() => void) | undefined;
    const res = operationEventStream((n) => {
      notify = n;
      return () => {};
    });
    const reader = res.body!.getReader();
    expect(await readChunk(reader)).toContain(": connected");
    expect(typeof notify).toBe("function");
    await reader.cancel();
  });

  it("clears the heartbeat and unsubscribes on cancel (no leaked timer)", async () => {
    vi.useFakeTimers();
    const unsubscribe = vi.fn();
    const res = operationEventStream(() => unsubscribe);
    expect(vi.getTimerCount()).toBe(1); // Heartbeat läuft

    await res.body!.cancel();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0); // kein verwaister Intervall-Timer
  });

  it("tears down once when enqueue fails after the stream closed", async () => {
    let notify: () => void = () => {};
    const unsubscribe = vi.fn();
    const res = operationEventStream((n) => {
      notify = n;
      return unsubscribe;
    });
    const reader = res.body!.getReader();
    await reader.read(); // Preamble lesen
    await reader.cancel(); // Strom geschlossen → unsubscribe (1)

    // Eine spätere Bus-Meldung läuft ins geschlossene Controller-enqueue:
    // der Fehler wird abgefangen und der Abbau bleibt idempotent.
    expect(() => notify()).not.toThrow();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
