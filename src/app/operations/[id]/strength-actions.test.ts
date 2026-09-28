import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/server/db/db";

// IO-/Trust-Grenzen faken, damit die echte Action-Logik unverändert läuft.
const state = vi.hoisted(() => ({
  db: undefined as unknown,
  token: undefined as string | undefined,
}));
vi.mock("@/server/db/pg", () => ({ getDb: () => state.db }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (state.token ? { value: state.token } : undefined),
    set: () => {},
    delete: () => {},
  }),
}));

import {
  createStationAction,
  renameStationAction,
} from "@/app/operations/[id]/strength-actions";
import { hashPassword } from "@/server/auth/password";
import { insertSession } from "@/server/auth/sessions";
import { insertUser } from "@/server/auth/users";
import { listEntries } from "@/server/journal/journal";
import { insertOperation } from "@/server/operations/operations";
import { listStations } from "@/server/strength/stations";
import { freshDb } from "@/test/db";

async function loginAs(username: string): Promise<void> {
  const db = state.db as Db;
  const user = await insertUser(db, {
    username,
    passwordHash: await hashPassword("a-very-good-password"),
    role: "user",
  });
  const token = randomUUID();
  await insertSession(db, {
    token,
    userId: user.id,
    expiresAt: new Date(Date.now() + 3_600_000),
  });
  state.token = token;
}

async function anOperation() {
  return insertOperation(state.db as Db, {
    name: "Cyclassics",
    description: null,
  });
}

beforeEach(async () => {
  state.db = await freshDb();
  state.token = undefined;
});

describe("strength actions", () => {
  it("creates a Stelle in the name of the logged-in user", async () => {
    await loginAs("anna");
    const op = await anOperation();

    expect(await createStationAction(op.id, "UHSt 3")).toEqual({});

    const db = state.db as Db;
    expect((await listStations(db, op.id)).map((s) => s.name)).toEqual([
      "UHSt 3",
    ]);
    expect(await listEntries(db, op.id)).toEqual([
      expect.objectContaining({
        text: "Stelle angelegt: UHSt 3",
        author: "anna",
      }),
    ]);
  });

  it("reports a duplicate name as a form error", async () => {
    await loginAs("anna");
    const op = await anOperation();
    await createStationAction(op.id, "UHSt 3");

    expect(await createStationAction(op.id, "uhst 3")).toEqual({
      error: "Eine Stelle mit diesem Namen gibt es schon.",
    });
  });

  it("renames a Stelle in the name of the logged-in user", async () => {
    await loginAs("bernd");
    const op = await anOperation();
    await createStationAction(op.id, "UHSt 3");
    const db = state.db as Db;
    const [station] = await listStations(db, op.id);

    expect(await renameStationAction(station.id, "UHSt 3 Nord")).toEqual({});

    expect((await listStations(db, op.id)).map((s) => s.name)).toEqual([
      "UHSt 3 Nord",
    ]);
    expect((await listEntries(db, op.id)).at(-1)).toMatchObject({
      text: "Stelle umbenannt: UHSt 3 → UHSt 3 Nord",
      author: "bernd",
    });
  });

  it("reports an empty new name as a form error", async () => {
    await loginAs("bernd");
    const op = await anOperation();
    await createStationAction(op.id, "UHSt 3");
    const [station] = await listStations(state.db as Db, op.id);

    expect(await renameStationAction(station.id, " ")).toEqual({
      error: "Der Name der Stelle darf nicht leer sein.",
    });
  });
});
