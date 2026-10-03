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

import type { EntryContent } from "@/journal/entry-route";
import { listEntries } from "@/server/journal/journal";
import { freshDb } from "@/test/db";
import {
  aJournalAndStrength,
  type JournalAndStrength,
  journalAndStrength,
} from "@/test/journal-and-strength";
import { signIn } from "@/test/sign-in";
import {
  addJournalEntryAction,
  annulEntryAction,
  correctEntryAction,
} from "./journal-actions";

// Server Actions nehmen, was der Client schickt – die Typen hier lügen absichtlich.
// biome-ignore lint/suspicious/noExplicitAny: bewusst falsch getypte Eingaben
type Bad = any;

type Call = (o: JournalAndStrength) => Promise<ActionResult>;

const NOT_A_UUID = "op-1";
const CONTENT: EntryContent = {
  text: "Pegel steigt",
  sender: "EAL",
  recipient: "UHSt 2",
  channel: "Telefon",
};

const longText = (length: number) => "x".repeat(length);

/** Beide Wege, einen Eintrag zu schreiben: anlegen und korrigieren. */
const writes: [
  string,
  (o: JournalAndStrength, content: Bad) => Promise<ActionResult>,
][] = [
  [
    "a new entry",
    (o, content) => addJournalEntryAction(o.operationId, content),
  ],
  ["a correction", (o, content) => correctEntryAction(o.entryId, content)],
];

const badContents: [string, string, unknown][] = [
  ["content null", "Ungültiger ETB-Eintrag.", null],
  ["content as text", "Ungültiger ETB-Eintrag.", "Pegel steigt"],
  ["a text as a number", "Der Text muss Text sein.", { ...CONTENT, text: 7 }],
  ["Von as a number", "Von muss Text sein.", { ...CONTENT, sender: 7 }],
  ["An as a number", "An muss Text sein.", { ...CONTENT, recipient: 7 }],
  ["a Weg as a number", "Der Weg muss Text sein.", { ...CONTENT, channel: 7 }],
  [
    "a text of 10,001 characters",
    "Der Text darf höchstens 10.000 Zeichen lang sein.",
    { ...CONTENT, text: longText(10_001) },
  ],
  [
    "Von of 201 characters",
    "Von darf höchstens 200 Zeichen lang sein.",
    { ...CONTENT, sender: longText(201) },
  ],
  [
    "An of 201 characters",
    "An darf höchstens 200 Zeichen lang sein.",
    { ...CONTENT, recipient: longText(201) },
  ],
  [
    "a Weg of 201 characters",
    "Der Weg darf höchstens 200 Zeichen lang sein.",
    { ...CONTENT, channel: longText(201) },
  ],
];

const badCalls: [string, string, Call][] = [
  [
    "a new entry with an Einsatz-ID that is not a UUID",
    "Ungültige ID.",
    () => addJournalEntryAction(NOT_A_UUID, CONTENT),
  ],
  [
    "a correction with an entry ID that is not a UUID",
    "Ungültige ID.",
    () => correctEntryAction(NOT_A_UUID, CONTENT),
  ],
  [
    "annulling with an entry ID that is not a UUID",
    "Ungültige ID.",
    () => annulEntryAction(NOT_A_UUID),
  ],
  ...writes.flatMap(([write, call]) =>
    badContents.map(([what, error, content]): [string, string, Call] => [
      `${write} with ${what}`,
      error,
      (o) => call(o, content),
    ]),
  ),
];

beforeEach(async () => {
  state.db = await freshDb();
  state.token = await signIn(state.db as Db);
});

describe.each(badCalls)("%s", (_, error, call) => {
  it("is rejected with a message and stores nothing", async () => {
    const o = await aJournalAndStrength(state.db as Db);
    const before = await journalAndStrength(state.db as Db, o.operationId);

    const result = await call(o);

    expect(result).toEqual({ error });
    expect(await journalAndStrength(state.db as Db, o.operationId)).toEqual(
      before,
    );
  });
});

describe.each(writes)("%s with the longest texts allowed", (_, call) => {
  it("stores a text of 10,000 characters, trimmed of surrounding blanks", async () => {
    const o = await aJournalAndStrength(state.db as Db);
    const text = longText(10_000);

    const result = await call(o, { ...CONTENT, text: `  ${text}\n` });

    expect(result).toEqual({});
    expect(await entries(o)).toContainEqual(expect.objectContaining({ text }));
  });

  it("stores Von, An and Weg of 200 characters each, trimmed", async () => {
    const o = await aJournalAndStrength(state.db as Db);
    const value = longText(200);

    const result = await call(o, {
      text: "Pegel steigt",
      sender: ` ${value} `,
      recipient: value,
      channel: value,
    });

    expect(result).toEqual({});
    expect(await entries(o)).toContainEqual(
      expect.objectContaining({
        sender: value,
        recipient: value,
        channel: value,
      }),
    );
  });
});

const entries = (o: JournalAndStrength) =>
  listEntries(state.db as Db, o.operationId);
