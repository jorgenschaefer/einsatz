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
};

export default nextConfig;
