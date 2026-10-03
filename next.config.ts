import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Der PDF→PNG-Renderer lädt zur Laufzeit native Bindings (@napi-rs/canvas),
  // pdfjs und Schriftdateien aus node_modules. Würde Turbopack sie in die
  // Server-Action bündeln, brächen diese Pfade – daher extern halten.
  serverExternalPackages: [
    "pdf-to-png-converter",
    "@napi-rs/canvas",
    "pdfjs-dist",
  ],
  experimental: {
    // Der Proxy (src/proxy.ts) läuft nur für Seitenaufrufe; einen Body tragen
    // dort höchstens Formulare vor der Hydrierung. Mehr als 1 MB puffert er
    // nicht. Uploads gehen an Route Handler, die selbst begrenzen.
    proxyClientMaxBodySize: "1mb",
  },
  poweredByHeader: false,
  // Die Content-Security-Policy setzt src/proxy.ts je Seite (Nonce).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
          { key: "Permissions-Policy", value: "geolocation=(self)" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
