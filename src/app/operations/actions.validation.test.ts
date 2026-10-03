import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/app/action-result";
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
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { redirectTo: to });
  },
}));

import {
  insertOperation,
  listOperations,
  setOperationStatus,
} from "@/server/operations/operations";
import { freshDb } from "@/test/db";
import { signIn } from "@/test/sign-in";
import { createOperationAction } from "./actions";
import {
  closeOperationAction,
  deleteOperationAction,
  reopenOperationAction,
} from "./lifecycle-actions";

// Server Actions nehmen, was der Client schickt – die Typen hier lügen absichtlich.
// biome-ignore lint/suspicious/noExplicitAny: bewusst falsch getypte Eingaben
type Bad = any;

const NOT_A_UUID = "op-1";
const longText = (length: number) => "x".repeat(length);

function operationForm(name: string, description = ""): FormData {
  const form = new FormData();
  form.set("name", name);
  form.set("description", description);
  return form;
}

function formWithFile(field: string): FormData {
  const form = operationForm("Hochwasser", "Deich Nord");
  form.set(field, new File(["Hochwasser"], "name.txt"));
  return form;
}

const badCalls: [string, string, () => Promise<ActionResult>][] = [
  [
    "Einsatz anlegen with a file as Bezeichnung",
    "Die Bezeichnung muss Text sein.",
    () => createOperationAction({}, formWithFile("name")),
  ],
  [
    "Einsatz anlegen with a file as Beschreibung",
    "Die Beschreibung muss Text sein.",
    () => createOperationAction({}, formWithFile("description")),
  ],
  [
    "Einsatz anlegen without a FormData",
    "Ungültige Formulardaten.",
    () => createOperationAction({}, "name=Hochwasser" as Bad),
  ],
  [
    "Einsatz anlegen with a Bezeichnung of 201 characters",
    "Die Bezeichnung darf höchstens 200 Zeichen lang sein.",
    () => createOperationAction({}, operationForm(longText(201))),
  ],
  [
    "Einsatz anlegen with a Beschreibung of 2,001 characters",
    "Die Beschreibung darf höchstens 2.000 Zeichen lang sein.",
    () =>
      createOperationAction({}, operationForm("Hochwasser", longText(2001))),
  ],
  [
    "Abschließen with an Einsatz-ID that is not a UUID",
    "Ungültige ID.",
    () => closeOperationAction(NOT_A_UUID),
  ],
  [
    "Wieder öffnen with an Einsatz-ID that is not a UUID",
    "Ungültige ID.",
    () => reopenOperationAction(NOT_A_UUID),
  ],
  [
    "Löschen with an Einsatz-ID that is not a UUID",
    "Ungültige ID.",
    () => deleteOperationAction(NOT_A_UUID),
  ],
];

let db: Db;

beforeEach(async () => {
  db = await freshDb();
  state.db = db;
  state.token = await signIn(db, "admin");
  await insertOperation(db, { name: "Laufend", description: null });
  const closed = await insertOperation(db, {
    name: "Abgeschlossen",
    description: null,
  });
  await setOperationStatus(db, closed.id, "closed");
});

describe.each(badCalls)("%s", (_, error, call) => {
  it("is rejected with a message and stores nothing", async () => {
    const before = await listOperations(db);

    expect(await call()).toEqual({ error });

    expect(await listOperations(db)).toEqual(before);
  });
});

describe("Einsatz anlegen with the longest texts allowed", () => {
  it("stores a Bezeichnung of 200 and a Beschreibung of 2,000 characters, trimmed", async () => {
    const name = longText(200);
    const description = longText(2000);

    await expect(
      createOperationAction(
        {},
        operationForm(` ${name} `, ` ${description}\n`),
      ),
    ).rejects.toMatchObject({
      redirectTo: expect.stringMatching(/^\/operations\//),
    });

    expect(await listOperations(db)).toContainEqual(
      expect.objectContaining({ name, description }),
    );
  });
});

describe("Einsatz anlegen without a FormData and without a session", () => {
  it("sends the caller to the login before looking at the input", async () => {
    state.token = undefined;

    await expect(
      createOperationAction({}, "name=Hochwasser" as Bad),
    ).rejects.toMatchObject({ redirectTo: "/login" });
  });
});
