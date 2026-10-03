import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Die Module unter `dir`, deren erste Anweisung `"use server"` ist, ohne Tests. */
export function serverActionModules(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((path) => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path))
    .map((path) => join(dir, path))
    .filter((file) => USE_SERVER_FIRST.test(readFileSync(file, "utf8")));
}

/** Die Direktive, davor nur Leerraum und Kommentare. */
const USE_SERVER_FIRST =
  /^(?:\s|\/\/[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)*["']use server["']/;
