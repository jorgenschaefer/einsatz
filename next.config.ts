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
    // Bild-Overlay-Uploads sind bis 20 MB erlaubt (MAX_UPLOAD_BYTES); der
    // Server-Action-Body braucht etwas Luft darüber (Multipart-Overhead), sonst
    // greift Nexts 1-MB-Default. So greift unsere eigene 20-MB-Prüfung mit
    // verständlicher Meldung, statt eines rohen „Body exceeded"-Fehlers.
    serverActions: { bodySizeLimit: "25mb" },
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
