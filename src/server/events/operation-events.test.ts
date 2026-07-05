import { describe, expect, it, vi } from "vitest";
import {
  publishOperationChanged,
  subscribeOperation,
} from "./operation-events";

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

  it("stops notifying after unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeOperation("op-x", listener);
    unsubscribe();
    publishOperationChanged("op-x");
    expect(listener).not.toHaveBeenCalled();
  });
});
