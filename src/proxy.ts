import { type NextRequest, NextResponse } from "next/server";

/**
 * Serves every page with a per-request nonce Content-Security-Policy. Next
 * reads the policy from the forwarded request headers and puts the nonce on
 * its own scripts; `x-nonce` is for our inline script in the root layout.
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = contentSecurityPolicy(
    nonce,
    process.env.NODE_ENV === "development",
  );

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

// Pages only. The proxy buffers every request body it runs for and silently
// truncates it at proxyClientMaxBodySize, so it must not run for server actions
// or route handlers (SSE, position reports, uploads, overlay images), which
// need no CSP anyway. A new route handler must be excluded here; proxy.test.ts
// fails for one that is not.
export const config = {
  matcher: [
    {
      source:
        "/((?!_next/static|_next/image|icon\\.svg|manifest\\.webmanifest|(?:operations|device|view)/[^/]+/(?:events|geocode|position|overlays|kml)(?:/|$)).*)",
      missing: [
        { type: "header", key: "next-action" },
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};

function contentSecurityPolicy(nonce: string, isDevelopment: boolean): string {
  // React needs eval for its dev tooling; without a MapTiler key, development
  // falls back to OSM tiles (src/map/tiles.ts).
  const scriptSrc = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];
  const imgSrc = ["'self'", "data:", "blob:", "https://api.maptiler.com"];
  if (isDevelopment) {
    scriptSrc.push("'unsafe-eval'");
    imgSrc.push("https://tile.openstreetmap.org");
  }
  // Mantine injects <style> tags and Leaflet sets style attributes. No nonce
  // in style-src: browsers ignore 'unsafe-inline' next to a nonce.
  return [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imgSrc.join(" ")}`,
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}
