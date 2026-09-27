import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/server/db/db";
import { freshDb } from "./db";

// Jede offene PGlite-Instanz hält ~260 MB; vergessene close()-Aufrufe ließen
// Testläufe in den Swap laufen. freshDb räumt deshalb nach jedem Test selbst auf.
// Die Tests bauen bewusst aufeinander auf (Vitest führt sie der Reihe nach aus).
describe("freshDb", () => {
  const fromHooks: Db[] = [];
  let fromTest: Db;

  beforeEach(async () => {
    fromHooks.push(await freshDb());
  });

  it("hands out a usable database", async () => {
    fromTest = await freshDb();
    await expect(fromTest.query("SELECT 1")).resolves.toBeDefined();
  });

  it("closes a database created in a test once that test has finished", async () => {
    await expect(fromTest.query("SELECT 1")).rejects.toThrow();
  });

  it("closes a database created in beforeEach once its test has finished", async () => {
    const [previous, current] = fromHooks.slice(-2);
    await expect(previous.query("SELECT 1")).rejects.toThrow();
    await expect(current.query("SELECT 1")).resolves.toBeDefined();
  });

  it("tolerates tests that still close their database explicitly", async () => {
    const db = await freshDb();
    await db.close();
  });
});
