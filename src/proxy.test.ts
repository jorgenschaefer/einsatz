import { globSync } from "node:fs";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { config, proxy } from "./proxy";

afterEach(() => {
  vi.unstubAllEnvs();
});

function pageResponse() {
  return proxy(new NextRequest("http://localhost/operations"));
}

function directives(csp: string | null): Map<string, string[]> {
  return new Map(
    (csp ?? "")
      .split(";")
      .map((directive) => directive.trim().split(/\s+/))
      .filter(([name]) => name)
      .map(([name, ...values]) => [name, values]),
  );
}

function responseCsp(response: Response) {
  return directives(response.headers.get("Content-Security-Policy"));
}

function forwardedRequestHeader(response: Response, name: string) {
  return response.headers.get(`x-middleware-request-${name}`);
}

describe("proxy: Content-Security-Policy of a page", () => {
  it("allows only the app's own scripts carrying this request's nonce", () => {
    vi.stubEnv("NODE_ENV", "production");
    const csp = responseCsp(pageResponse());
    const scriptSrc = csp.get("script-src") ?? [];
    expect(scriptSrc).toEqual([
      "'self'",
      expect.stringMatching(/^'nonce-[A-Za-z0-9+/=]{16,}'$/),
      "'strict-dynamic'",
    ]);
  });

  it("restricts every other source to the app, MapTiler tiles and inline data", () => {
    vi.stubEnv("NODE_ENV", "production");
    const csp = responseCsp(pageResponse());
    expect(Object.fromEntries(csp)).toMatchObject({
      "default-src": ["'self'"],
      "style-src": ["'self'", "'unsafe-inline'"],
      "img-src": ["'self'", "data:", "blob:", "https://api.maptiler.com"],
      "connect-src": ["'self'"],
      "frame-ancestors": ["'none'"],
      "object-src": ["'none'"],
      "base-uri": ["'self'"],
      "form-action": ["'self'"],
    });
  });

  it("additionally allows eval and OSM tiles in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    const csp = responseCsp(pageResponse());
    expect(csp.get("script-src")).toContain("'unsafe-eval'");
    expect(csp.get("img-src")).toContain("https://tile.openstreetmap.org");
  });

  it("forwards the same policy and its nonce to the page render", () => {
    const response = pageResponse();
    const policy = response.headers.get("Content-Security-Policy");
    const nonce = forwardedRequestHeader(response, "x-nonce");
    expect(forwardedRequestHeader(response, "content-security-policy")).toBe(
      policy,
    );
    expect(nonce).toBeTruthy();
    expect(policy).toContain(`'nonce-${nonce}'`);
  });

  it("uses a fresh nonce for every request", () => {
    const first = forwardedRequestHeader(pageResponse(), "x-nonce");
    const second = forwardedRequestHeader(pageResponse(), "x-nonce");
    expect(first).not.toBe(second);
  });
});

describe("proxy: which requests it runs for", () => {
  const operationId = "6f1c2a4e-8b3d-4e5f-9a7b-0c1d2e3f4a5b";

  function runsFor(url: string, headers: Record<string, string> = {}) {
    return unstable_doesMiddlewareMatch({
      config,
      url: `http://localhost${url}`,
      headers,
    });
  }

  it.each(appUrls("page.tsx"))("runs for the page %s", (url) => {
    expect(runsFor(url)).toBe(true);
  });

  it.each(appUrls("route.ts"))(
    "does not run for the route handler %s",
    (url) => {
      expect(runsFor(url)).toBe(false);
    },
  );

  it.each([
    `/operations/${operationId}/kml`,
    `/operations/${operationId}/overlays`,
    `/operations/${operationId}/overlays/${operationId}`,
    "/device/x/position",
  ])("does not run for the upload %s, so it cannot truncate it", (url) => {
    expect(
      runsFor(url, { "content-type": "multipart/form-data; boundary=x" }),
    ).toBe(false);
  });

  it.each([
    "/_next/static/chunks/main.js",
    "/_next/image",
    "/icon.svg",
    "/manifest.webmanifest",
  ])("does not run for the static asset %s", (url) => {
    expect(runsFor(url)).toBe(false);
  });

  it("does not run for a server action, so it cannot truncate an upload", () => {
    expect(
      runsFor(`/operations/${operationId}`, { "next-action": "abc123" }),
    ).toBe(false);
  });

  it.each<Record<string, string>>([
    { "next-router-prefetch": "1" },
    { purpose: "prefetch" },
  ])("does not run for a prefetch (%o)", (headers) => {
    expect(runsFor("/operations", headers)).toBe(false);
  });
});

/** The URL of every `fileName` under src/app, a sample value in each dynamic segment. */
function appUrls(fileName: string): string[] {
  const urls = globSync(`**/${fileName}`, { cwd: "src/app" }).map(
    (file) =>
      `/${file}`
        .replace(new RegExp(`/?${fileName}$`), "")
        .replace(/\[[^\]]+\]/g, "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d") || "/",
  );
  expect(urls).not.toHaveLength(0);
  return urls;
}
