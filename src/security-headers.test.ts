import { unstable_getResponseFromNextConfig } from "next/experimental/testing/server";
import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";

describe("security headers from next.config.ts", () => {
  it.each([
    ["a page", "/operations"],
    ["a route handler", "/device/x/position"],
    ["a static asset", "/_next/static/x.js"],
  ])("are on every response, here %s", async (_kind, path) => {
    const response = await unstable_getResponseFromNextConfig({
      url: `http://localhost${path}`,
      nextConfig,
    });
    expect(Object.fromEntries(response.headers)).toMatchObject({
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "strict-transport-security": "max-age=31536000",
      "permissions-policy": "geolocation=(self)",
      "x-frame-options": "DENY",
    });
  });

  it("does not announce the framework with X-Powered-By", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});
