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

import type { ActionResult } from "@/app/action-result";
import type { EntryContent } from "@/journal/entry-route";
import { listEntries } from "@/server/journal/journal";
import { insertOperation } from "@/server/operations/operations";
import {
  type ActAs,
  expectBadCallsRejected,
  expectEveryActionRequiresLogin,
  expectForeignObjectsRejected,
} from "@/test/action-checks";
import {
  type Bad,
  type BadCall,
  INVALID_ID,
  NOT_A_UUID,
  rejects,
  text,
  tooLong,
} from "@/test/bad-calls/bad-call";
import { freshDb } from "@/test/db";
import { liveEventsFor } from "@/test/live-events";
import {
  aJournalAndStrength,
  ENTRY,
  type Fixture,
  type JournalAndStrength,
} from "@/test/operation-fixture";
import { signIn, signInAs } from "@/test/sign-in";
import * as actions from "./journal-actions";

const { addJournalEntryAction, annulEntryAction, correctEntryAction } = actions;

const actAs: ActAs = async (caller) => {
  state.token =
    caller === "anonymous" ? undefined : await signIn(state.db as Db, caller);
};
const db = () => state.db as Db;

beforeEach(async () => {
  state.db = await freshDb();
  state.token = undefined;
});

expectEveryActionRequiresLogin(actions, { actAs });

expectBadCallsRejected(
  actions,
  {
    addJournalEntryAction: [
      rejects("a non-UUID Einsatz-ID", INVALID_ID, () =>
        addJournalEntryAction(NOT_A_UUID, ENTRY),
      ),
      ...entryContentCalls((f, content) =>
        addJournalEntryAction(f.operationId, content),
      ),
    ],
    correctEntryAction: [
      rejects("a non-UUID Eintrag-ID", INVALID_ID, () =>
        correctEntryAction(NOT_A_UUID, ENTRY),
      ),
      ...entryContentCalls((f, content) =>
        correctEntryAction(f.entryId, content),
      ),
    ],
    annulEntryAction: [
      rejects("a non-UUID Eintrag-ID", INVALID_ID, () =>
        annulEntryAction(NOT_A_UUID),
      ),
      rejects("an Eintrag-ID as a number", INVALID_ID, () =>
        annulEntryAction(7 as Bad),
      ),
    ],
  },
  { db, actAs },
);

expectForeignObjectsRejected(
  actions,
  {
    addJournalEntryAction: "takes only the Einsatz-ID",
    correctEntryAction: "takes no Einsatz-ID",
    annulEntryAction: "takes no Einsatz-ID",
  },
  { db, actAs },
);

describe("journal actions", () => {
  it("adds a manual entry with Von, An and Weg and tells the Führungsansichten once", async () => {
    state.token = await signInAs(db(), "anna");
    const op = await anOperation();

    const { events } = await liveEventsFor(op.id, async () => {
      expect(
        await addJournalEntryAction(op.id, {
          text: "Deich hält",
          sender: "UHSt 2",
          recipient: "EAL",
          channel: "Funk",
        }),
      ).toEqual({});
    });

    expect(await listEntries(db(), op.id)).toEqual([
      expect.objectContaining({
        text: "Deich hält",
        type: "manuell",
        author: "anna",
        sender: "UHSt 2",
        recipient: "EAL",
        channel: "Funk",
      }),
    ]);
    expect(events).toBe(1);
  });

  it("corrects Von, An and Weg of an entry and tells the Führungsansichten once", async () => {
    state.token = await signInAs(db(), "bernd");
    const op = await anOperation();
    await addJournalEntryAction(op.id, {
      text: "Deich hält",
      sender: "UHSt 2",
      recipient: "EAL",
      channel: "Funk",
    });
    const [entry] = await listEntries(db(), op.id);

    const { events } = await liveEventsFor(op.id, async () => {
      expect(
        await correctEntryAction(entry.id, {
          text: "Deich hält",
          sender: "EAL",
          recipient: "UHSt 2",
          channel: "Telefon",
        }),
      ).toEqual({});
    });

    expect(await listEntries(db(), op.id)).toEqual([
      expect.objectContaining({
        text: "Deich hält",
        sender: "EAL",
        recipient: "UHSt 2",
        channel: "Telefon",
        revisions: [expect.objectContaining({ channel: "Funk" })],
      }),
    ]);
    expect(events).toBe(1);
  });
});

const CONTENT: EntryContent = {
  text: "Pegel steigt",
  sender: "EAL",
  recipient: "UHSt 2",
  channel: "Telefon",
};

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

describe.each(writes)("%s with the longest texts allowed", (_, call) => {
  beforeEach(() => actAs("user"));

  it("stores a text of 10,000 characters, trimmed of surrounding blanks", async () => {
    const o = await aJournalAndStrength(db());
    const longest = text(10_000);

    const result = await call(o, { ...CONTENT, text: `  ${longest}\n` });

    expect(result).toEqual({});
    expect(await listEntries(db(), o.operationId)).toContainEqual(
      expect.objectContaining({ text: longest }),
    );
  });

  it("stores Von, An and Weg of 200 characters each, trimmed", async () => {
    const o = await aJournalAndStrength(db());
    const value = text(200);

    const result = await call(o, {
      text: "Pegel steigt",
      sender: ` ${value} `,
      recipient: value,
      channel: value,
    });

    expect(result).toEqual({});
    expect(await listEntries(db(), o.operationId)).toContainEqual(
      expect.objectContaining({
        sender: value,
        recipient: value,
        channel: value,
      }),
    );
  });
});

function entryContentCalls(
  action: (f: Fixture, content: Bad) => Promise<unknown>,
): BadCall[] {
  return [
    rejects("content of null", "Ungültiger ETB-Eintrag.", (f) =>
      action(f, null),
    ),
    rejects("content as text", "Ungültiger ETB-Eintrag.", (f) =>
      action(f, "Pegel steigt"),
    ),
    rejects("a text as a number", "Der Text muss Text sein.", (f) =>
      action(f, { ...ENTRY, text: 7 }),
    ),
    rejects("a text of 10,001", tooLong("Der Text", "10.000"), (f) =>
      action(f, { ...ENTRY, text: text(10_001) }),
    ),
    rejects("a Von as a number", "Von muss Text sein.", (f) =>
      action(f, { ...ENTRY, sender: 7 }),
    ),
    rejects("a Von of 201", tooLong("Von", "200"), (f) =>
      action(f, { ...ENTRY, sender: text(201) }),
    ),
    rejects("an An as a number", "An muss Text sein.", (f) =>
      action(f, { ...ENTRY, recipient: 7 }),
    ),
    rejects("an An of 201", tooLong("An", "200"), (f) =>
      action(f, { ...ENTRY, recipient: text(201) }),
    ),
    rejects("a Weg as a number", "Der Weg muss Text sein.", (f) =>
      action(f, { ...ENTRY, channel: 7 }),
    ),
    rejects("a Weg of 201", tooLong("Der Weg", "200"), (f) =>
      action(f, { ...ENTRY, channel: text(201) }),
    ),
  ];
}

function anOperation() {
  return insertOperation(db(), { name: "Cyclassics", description: null });
}
