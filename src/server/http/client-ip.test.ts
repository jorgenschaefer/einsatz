import { describe, expect, it } from "vitest";
import { clientIpFromForwardedFor } from "./client-ip";

describe("clientIpFromForwardedFor", () => {
  it("returns the single forwarded IP", () => {
    expect(clientIpFromForwardedFor("203.0.113.7")).toBe("203.0.113.7");
  });

  it("takes the rightmost (proxy-appended) entry, not the client-controllable first", () => {
    expect(clientIpFromForwardedFor("1.2.3.4, 203.0.113.7")).toBe(
      "203.0.113.7",
    );
  });

  it('falls back to "local" when the header is missing or empty', () => {
    expect(clientIpFromForwardedFor(null)).toBe("local");
    expect(clientIpFromForwardedFor("")).toBe("local");
    expect(clientIpFromForwardedFor("  ")).toBe("local");
  });
});
