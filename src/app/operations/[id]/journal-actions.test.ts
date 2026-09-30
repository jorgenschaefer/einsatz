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
  addJournalEntryAction,
  correctEntryAction,
} from "@/app/operations/[id]/journal-actions";
import { hashPassword } from "@/server/auth/password";
import { insertSession } from "@/server/auth/sessions";
import { insertUser } from "@/server/auth/users";
import { subscribeOperation } from "@/server/events/operation-events";
import { listEntries } from "@/server/journal/journal";
import { insertOperation } from "@/server/operations/operations";
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

/** How many live events the Führungsansichten of `operationId` receive while `act` runs. */
async function liveEventsFor(
  operationId: string,
  act: () => Promise<unknown>,
): Promise<number> {
  let events = 0;
  const unsubscribe = subscribeOperation(operationId, () => {
    events += 1;
  });
  try {
    await act();
  } finally {
    unsubscribe();
  }
  return events;
}

beforeEach(async () => {
  state.db = await freshDb();
  state.token = undefined;
});

describe("journal actions", () => {
  it("adds a manual entry with Von, An and Weg and tells the Führungsansichten once", async () => {
    await loginAs("anna");
    const op = await insertOperation(state.db as Db, {
      name: "Cyclassics",
      description: null,
    });

    const events = await liveEventsFor(op.id, async () => {
      expect(
        await addJournalEntryAction(op.id, {
          text: "Deich hält",
          sender: "UHSt 2",
          recipient: "EAL",
          channel: "Funk",
        }),
      ).toEqual({});
    });

    expect(await listEntries(state.db as Db, op.id)).toEqual([
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
    await loginAs("bernd");
    const op = await insertOperation(state.db as Db, {
      name: "Cyclassics",
      description: null,
    });
    await addJournalEntryAction(op.id, {
      text: "Deich hält",
      sender: "UHSt 2",
      recipient: "EAL",
      channel: "Funk",
    });
    const [entry] = await listEntries(state.db as Db, op.id);

    const events = await liveEventsFor(op.id, async () => {
      expect(
        await correctEntryAction(entry.id, {
          text: "Deich hält",
          sender: "EAL",
          recipient: "UHSt 2",
          channel: "Telefon",
        }),
      ).toEqual({});
    });

    expect(await listEntries(state.db as Db, op.id)).toEqual([
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
