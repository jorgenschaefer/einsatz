import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertAtMostTwoPerSecond,
  assertLastChangeArrivesWithinOneSecond,
} from "./coalescing.fixtures";
import {
  publishOperationChanged,
  subscribeOperation,
} from "./operation-events";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.runAllTimers(); // keine offenen Fenster in den nächsten Test mitnehmen
  vi.useRealTimers();
});

describe("operation events bus", () => {
  it("notifies subscribers of their own operation only", () => {
    const a = vi.fn();
    const b = vi.fn();
    subscribeOperation("op-a", a);
    subscribeOperation("op-b", b);

    publishOperationChanged("op-a");
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
  });

  it("notifies every subscriber of the same operation", () => {
    const one = vi.fn();
    const two = vi.fn();
    subscribeOperation("op-multi", one);
    subscribeOperation("op-multi", two);

    publishOperationChanged("op-multi");
    expect(one).toHaveBeenCalledTimes(1);
    expect(two).toHaveBeenCalledTimes(1);
  });

  it("isolates a throwing listener from the others and from the publisher", () => {
    const bad = vi.fn(() => {
      throw new Error("stream closed");
    });
    const good = vi.fn();
    subscribeOperation("op-iso", bad);
    subscribeOperation("op-iso", good);

    expect(() => publishOperationChanged("op-iso")).not.toThrow();
    expect(good).toHaveBeenCalledTimes(1); // ein kaputter Abonnent bricht die Verteilung nicht ab
  });

  it("isolates a throwing listener also in a delayed notification", () => {
    const bad = vi.fn(() => {
      throw new Error("stream closed");
    });
    const good = vi.fn();
    subscribeOperation("op-iso-late", bad);
    subscribeOperation("op-iso-late", good);

    publishOperationChanged("op-iso-late");
    publishOperationChanged("op-iso-late");
    expect(() => vi.runAllTimers()).not.toThrow();
    expect(good).toHaveBeenCalledTimes(2);
  });

  it("stops notifying after unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeOperation("op-x", listener);
    unsubscribe();
    publishOperationChanged("op-x");
    expect(listener).not.toHaveBeenCalled();
  });

  it("does not deliver a delayed notification to a listener that unsubscribed", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeOperation("op-gone", listener);
    publishOperationChanged("op-gone");
    publishOperationChanged("op-gone");
    unsubscribe();

    vi.runAllTimers();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("coalescing changes per Einsatz", () => {
  it("notifies at once when an idle Einsatz changes", () => {
    const listener = vi.fn();
    subscribeOperation("op-idle", listener);

    publishOperationChanged("op-idle");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("notifies at most twice per second for a burst of 50 changes over 2 s", () => {
    const publishTimes = Array.from({ length: 50 }, (_, i) => i * 40);
    const notified = notificationTimes("op-burst", publishTimes);

    assertAtMostTwoPerSecond(notified);
    assertLastChangeArrivesWithinOneSecond(notified, publishTimes);
  });

  it("notifies at most twice per second for changes on the window edges", () => {
    const edges = [500, 600].flatMap((step) =>
      Array.from({ length: 3000 / step }, (_, i) => (i + 1) * step),
    );
    const publishTimes = [
      ...new Set([0, ...edges.flatMap((t) => [t - 1, t])]),
    ].sort((a, b) => a - b);
    const notified = notificationTimes("op-edges", publishTimes);

    assertAtMostTwoPerSecond(notified);
    assertLastChangeArrivesWithinOneSecond(notified, publishTimes);
  });

  it("does not hold back one Einsatz with a burst on another", () => {
    const a = vi.fn();
    const b = vi.fn();
    subscribeOperation("op-burst-a", a);
    subscribeOperation("op-burst-b", b);

    publishOperationChanged("op-burst-a");
    publishOperationChanged("op-burst-a");
    publishOperationChanged("op-burst-b");

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });
});

/**
 * Publishes at the given offsets (ms from now) and returns the offsets at which
 * a subscriber was notified, once every pending notification has gone out.
 */
function notificationTimes(
  operationId: string,
  publishTimes: number[],
): number[] {
  const start = Date.now();
  const notified: number[] = [];
  subscribeOperation(operationId, () => notified.push(Date.now() - start));
  for (const t of publishTimes) {
    vi.advanceTimersByTime(start + t - Date.now());
    publishOperationChanged(operationId);
  }
  vi.runAllTimers();
  return notified;
}
