import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertAtMostTwoPerSecond,
  assertLastChangeArrivesWithinOneSecond,
} from "./coalescing.fixtures";
import {
  publishOperationChanged,
  subscribeOperation,
} from "./operation-events";
import { operationEventStream } from "./sse";

afterEach(() => {
  vi.useRealTimers();
});

const HEARTBEAT_MS = 25_000;
const HOUR = 60 * 60_000;

type StreamOptions = Parameters<typeof operationEventStream>[0];

function stream(options: Partial<StreamOptions> = {}): Response {
  return operationEventStream({
    subscribe: () => () => {},
    stillAllowed: async () => true,
    onClose: () => {},
    ...options,
  });
}

async function readChunk(reader: ReadableStreamDefaultReader<Uint8Array>) {
  const { value } = await reader.read();
  return new TextDecoder().decode(value);
}

/** Liest den Strom im Hintergrund leer und hält fest, wann er endete. */
function watchEnd(res: Response): { endedAfter: () => number | undefined } {
  const reader = res.body!.getReader();
  const start = Date.now();
  let endedAfter: number | undefined;
  void (async () => {
    for (;;) {
      if ((await reader.read()).done) break;
    }
    endedAfter = Date.now() - start;
  })();
  return { endedAfter: () => endedAfter };
}

describe("operationEventStream", () => {
  it("emits the connected preamble and subscribes to the bus", async () => {
    let notify: (() => void) | undefined;
    const res = stream({
      subscribe: (n) => {
        notify = n;
        return () => {};
      },
    });
    const reader = res.body!.getReader();
    expect(await readChunk(reader)).toContain(": connected");
    expect(typeof notify).toBe("function");
    await reader.cancel();
  });

  it("clears the heartbeat and unsubscribes on cancel (no leaked timer)", async () => {
    vi.useFakeTimers();
    const unsubscribe = vi.fn();
    const res = stream({ subscribe: () => unsubscribe });
    expect(vi.getTimerCount()).toBe(1); // Heartbeat läuft

    await res.body!.cancel();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0); // kein verwaister Intervall-Timer
  });

  it("tears down once when enqueue fails after the stream closed", async () => {
    let notify: () => void = () => {};
    const unsubscribe = vi.fn();
    const onClose = vi.fn();
    const res = stream({
      subscribe: (n) => {
        notify = n;
        return unsubscribe;
      },
      onClose,
    });
    const reader = res.body!.getReader();
    await reader.read(); // Preamble lesen
    await reader.cancel(); // Strom geschlossen → unsubscribe (1)

    // Eine spätere Bus-Meldung läuft ins geschlossene Controller-enqueue:
    // der Fehler wird abgefangen und der Abbau bleibt idempotent.
    expect(() => notify()).not.toThrow();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("sends a heartbeat while access remains", async () => {
    vi.useFakeTimers();
    const reader = stream().body!.getReader();
    await reader.read(); // Preamble
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
    expect(await readChunk(reader)).toBe(": ping\n\n");
    await reader.cancel();
  });

  it("ends on the first heartbeat after access is gone, and releases once", async () => {
    vi.useFakeTimers();
    let allowed = true;
    const onClose = vi.fn();
    const unsubscribe = vi.fn();
    const res = stream({
      subscribe: () => unsubscribe,
      stillAllowed: async () => allowed,
      onClose,
    });
    const end = watchEnd(res);

    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
    allowed = false;
    expect(end.endedAfter()).toBeUndefined();
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);

    expect(end.endedAfter()).toBe(2 * HEARTBEAT_MS);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("ends when the access check fails", async () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const res = stream({
      stillAllowed: () => Promise.reject(new Error("db down")),
      onClose,
    });
    const end = watchEnd(res);

    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);

    expect(end.endedAfter()).toBe(HEARTBEAT_MS);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ends after one hour at the latest", async () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const end = watchEnd(stream({ onClose }));

    await vi.advanceTimersByTimeAsync(HOUR - 1);
    expect(end.endedAfter()).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);

    expect(end.endedAfter()).toBe(HOUR);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("releases once on cancel", async () => {
    const onClose = vi.fn();
    const res = stream({ onClose });
    await res.body!.cancel();
    await res.body!.cancel();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("sends a burst of bus changes as at most two messages per second", async () => {
    vi.useFakeTimers();
    const res = stream({
      subscribe: (notify) => subscribeOperation("op-sse-burst", notify),
    });
    const reader = res.body!.getReader();
    const start = Date.now();
    const changedAt: number[] = [];
    const reading = (async () => {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) return;
        const chunk = new TextDecoder().decode(value);
        if (chunk.includes("data: changed")) changedAt.push(Date.now() - start);
      }
    })();

    const publishTimes = Array.from({ length: 50 }, (_, i) => i * 40);
    for (const t of publishTimes) {
      await vi.advanceTimersByTimeAsync(start + t - Date.now());
      publishOperationChanged("op-sse-burst");
    }
    await vi.advanceTimersByTimeAsync(1000);
    await reader.cancel();
    await reading;

    expect(changedAt[0]).toBe(0);
    assertAtMostTwoPerSecond(changedAt);
    assertLastChangeArrivesWithinOneSecond(changedAt, publishTimes);
  });
});
