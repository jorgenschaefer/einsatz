import { describe, expect, it } from "vitest";
import { openLiveConnection } from "./live-connections";

describe("openLiveConnection", () => {
  it("lets connections in up to the limit and refuses the next", () => {
    expect(openLiveConnection("t:limit", 2)).not.toBeNull();
    expect(openLiveConnection("t:limit", 2)).not.toBeNull();
    expect(openLiveConnection("t:limit", 2)).toBeNull();
  });

  it("lets the next one in once a connection is released", () => {
    const release = openLiveConnection("t:release", 1);
    release?.();
    expect(openLiveConnection("t:release", 1)).not.toBeNull();
  });

  it("frees only one place when a connection is released twice", () => {
    const first = openLiveConnection("t:twice", 2);
    openLiveConnection("t:twice", 2);
    first?.();
    first?.();
    expect(openLiveConnection("t:twice", 2)).not.toBeNull();
    expect(openLiveConnection("t:twice", 2)).toBeNull();
  });

  it("counts each key on its own", () => {
    openLiveConnection("t:a", 1);
    expect(openLiveConnection("t:b", 1)).not.toBeNull();
  });
});
