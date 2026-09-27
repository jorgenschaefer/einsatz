import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/** .ts-Tests, die trotzdem ein DOM brauchen (Browser-Hooks, Leaflet, Storage). */
const browserTestsInTs = [
  "src/map/use*.test.ts",
  "src/map/leaflet-adapter.*.test.ts",
  "src/map/last-view-storage.test.ts",
];

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    globalSetup: ["./src/test/db-templates.ts"],
    // jsdom kostet ~3 s Aufbau je Testdatei; nur Tests, die ein DOM brauchen
    // (Komponenten, Browser-Hooks, Leaflet), bekommen es. Alles andere läuft
    // unter Node.
    projects: [
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          setupFiles: ["./src/test/setup.ts"],
          include: ["src/**/*.test.tsx", ...browserTestsInTs],
        },
      },
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["src/**/*.test.ts"],
          exclude: browserTestsInTs,
        },
      },
    ],
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
