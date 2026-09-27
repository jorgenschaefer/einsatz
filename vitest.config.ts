import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    globalSetup: ["./src/test/db-templates.ts"],
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    // PGlite (In-Process-DB) initialisiert je Test frisch; unter Last/CI kann das
    // die knappen 5 s überschreiten. Großzügiger Timeout hält die DB-Tests stabil.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // `taktische-zeichen-core` enthält im veröffentlichten Build versehentliche
    // console.log-Aufrufe beim Base64-Kodieren der dataUrl. Beim Rendern von
    // Kartenzeichen fluten diese das Testprotokoll mit dem kompletten SVG.
    // Nur diese Debug-Zeilen ausblenden, alle übrigen Logs bleiben sichtbar.
    onConsoleLog(log) {
      if (log.startsWith("using Buffer to encode base64:")) return false;
      if (log.startsWith("using Array to encode base64:")) return false;
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` ist ein Next.js-Build-Marker, kein installiertes Paket –
      // im Test auf einen leeren Stub umbiegen, damit Servermodule importierbar sind.
      "server-only": fileURLToPath(
        new URL("./src/test/server-only-stub.ts", import.meta.url),
      ),
    },
  },
});
