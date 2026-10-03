import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/server/db/db";

// IO-/Trust-Grenzen faken, damit die echte Action-Logik unverändert läuft.
const state = vi.hoisted(() => ({
  db: undefined as unknown,
  token: undefined as string | undefined,
}));
vi.mock("@/server/db/pg", () => ({ getDb: () => state.db }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({
    get: () => (state.token ? { value: state.token } : undefined),
    set: () => {},
    delete: () => {},
  }),
}));
vi.mock("next/navigation", async (original) => ({
  ...(await original<object>()),
  redirect: (to: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { redirectTo: to });
  },
}));
// Was durchrutscht, soll auffallen: eine geladene KML würde gespeichert, eine
// Suche brächte einen Treffer.
vi.mock("@/server/kml/kml-import", () => ({
  loadKmlFromUrl: async () => "<kml>neu</kml>",
}));
vi.mock("@/server/geocoder/photon", () => ({
  photonGeocoder: {
    geocode: async () => [{ label: "Treffer", lat: 50, lng: 8 }],
  },
}));

import type { BadCall, BadCalls } from "@/test/bad-calls/bad-call";
import { oneOfEach } from "@/test/bad-calls/fixture";
import { JOURNAL_STRENGTH_BAD_CALLS } from "@/test/bad-calls/journal-strength";
import { MAP_BAD_CALLS } from "@/test/bad-calls/map";
import { OPERATIONS_ACCOUNTS_BAD_CALLS } from "@/test/bad-calls/operations-accounts";
import { freshDb } from "@/test/db";
import { snapshotDb } from "@/test/db-snapshot";
import { serverActionModules } from "@/test/server-action-modules";
import { signIn } from "@/test/sign-in";

const SRC = join(__dirname, "..");
const UPLOADS_DIR = mkdtempSync(join(tmpdir(), "einsatz-actions-"));
const originalUploadsDir = process.env.UPLOADS_DIR;
process.env.UPLOADS_DIR = UPLOADS_DIR;

/**
 * Jede Server Action mit falschen Eingaben für jeden ihrer Parameter: Ids, die
 * keine UUID sind, falsche Typen, zu lange Texte (AC-22).
 */
const TABLES = [
  OPERATIONS_ACCOUNTS_BAD_CALLS,
  MAP_BAD_CALLS,
  JOURNAL_STRENGTH_BAD_CALLS,
];
const BAD_CALLS: BadCalls = Object.assign({}, ...TABLES);

beforeEach(async () => {
  state.db = await freshDb();
  state.token = await signIn(state.db as Db, "admin");
});

afterAll(() => {
  rmSync(UPLOADS_DIR, { recursive: true, force: true });
  if (originalUploadsDir === undefined) delete process.env.UPLOADS_DIR;
  else process.env.UPLOADS_DIR = originalUploadsDir;
});

describe("the table of bad calls", () => {
  it("names every exported server action, and nothing else", async () => {
    const exported = (await serverActions()).map(([name]) => name);

    expect(exported.toSorted()).toEqual(Object.keys(BAD_CALLS).toSorted());
  });

  it("says an action takes no input only when it has no parameters", async () => {
    const mislabelled = (await serverActions())
      .filter(
        ([name, action]) =>
          action.length > 0 && BAD_CALLS[name] === "takes no input",
      )
      .map(([name]) => name);

    expect(mislabelled).toEqual([]);
  });

  it("names no action twice", () => {
    const names = TABLES.flatMap((table) => Object.keys(table));

    expect(names).toHaveLength(new Set(names).size);
  });

  it("gives every action that takes input at least one bad call", () => {
    const withoutCalls = Object.entries(BAD_CALLS)
      .filter(([, calls]) => calls.length === 0)
      .map(([action]) => action);

    expect(withoutCalls).toEqual([]);
  });
});

describe.each(
  Object.entries(BAD_CALLS).flatMap(([action, calls]) =>
    calls === "takes no input"
      ? []
      : calls.map((c): [string, BadCall] => [`${action} with ${c.what}`, c]),
  ),
)("%s", (_, { answer, call }) => {
  it("is rejected with a message and stores nothing", async () => {
    const fixture = await oneOfEach(state.db as Db, UPLOADS_DIR);
    const before = await everything();

    const result = await call(fixture);

    expect(result).toMatchObject(answer as object);
    expect(await everything()).toEqual(before);
  });
});

type ServerAction = (...args: never[]) => unknown;

/** Jede exportierte Funktion jedes Server-Action-Moduls, mit ihrem Namen. */
async function serverActions(): Promise<[string, ServerAction][]> {
  const actions: [string, ServerAction][] = [];
  for (const file of serverActionModules(SRC)) {
    const module: Record<string, unknown> = await import(file);
    for (const [name, value] of Object.entries(module)) {
      if (typeof value === "function") {
        actions.push([name, value as ServerAction]);
      }
    }
  }
  return actions;
}

/** Jede Zeile jeder Tabelle und jede Datei im Upload-Verzeichnis. */
async function everything() {
  return {
    tables: await snapshotDb(state.db as Db),
    uploads: readdirSync(UPLOADS_DIR, {
      recursive: true,
      encoding: "utf8",
    }).toSorted(),
  };
}
