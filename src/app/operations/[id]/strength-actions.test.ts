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
  headers: async () => new Headers(),
  cookies: async () => ({
    get: () => (state.token ? { value: state.token } : undefined),
    set: () => {},
    delete: () => {},
  }),
}));

import {
  annulStrengthReportAction,
  correctStrengthReportAction,
  createStationAction,
  recordStrengthReportAction,
  renameStationAction,
  reportTotalStrengthAction,
} from "@/app/operations/[id]/strength-actions";
import { hashPassword } from "@/server/auth/password";
import { insertSession } from "@/server/auth/sessions";
import { insertUser } from "@/server/auth/users";
import { subscribeOperation } from "@/server/events/operation-events";
import { listEntries } from "@/server/journal/journal";
import { insertOperation } from "@/server/operations/operations";
import { listStations } from "@/server/strength/stations";
import { listStrengthReports } from "@/server/strength/strength-reports";
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

const SOME_VALUES = {
  leaders: 0,
  subLeaders: 1,
  crew: 6,
  additionalPersonnel: 2,
  note: null,
};

async function aStationWithAReport() {
  const op = await anOperation();
  await createStationAction(op.id, "UHSt 3");
  const db = state.db as Db;
  const [station] = await listStations(db, op.id);
  await recordStrengthReportAction(station.id, SOME_VALUES);
  const [report] = await listStrengthReports(db, op.id);
  return { operationId: op.id, stationId: station.id, reportId: report.id };
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

  it("records a Stärkemeldung in the name of the logged-in user", async () => {
    await loginAs("bernd");
    const op = await anOperation();
    await createStationAction(op.id, "UHSt 3");
    const db = state.db as Db;
    const [station] = await listStations(db, op.id);
    const values = {
      leaders: 0,
      subLeaders: 1,
      crew: 6,
      additionalPersonnel: 2,
      note: null,
    };

    expect(await recordStrengthReportAction(station.id, values)).toEqual({});

    expect(await listStrengthReports(db, op.id)).toEqual([
      expect.objectContaining(values),
    ]);
    expect((await listEntries(db, op.id)).at(-1)).toMatchObject({
      text: "Stärkemeldung UHSt 3: 0/1/6//7, +2 zusätzlich, 9 Personen",
      author: "bernd",
    });
  });

  it("reports a negative number as a form error", async () => {
    await loginAs("bernd");
    const op = await anOperation();
    await createStationAction(op.id, "UHSt 3");
    const [station] = await listStations(state.db as Db, op.id);

    expect(
      await recordStrengthReportAction(station.id, {
        leaders: -1,
        subLeaders: 0,
        crew: 0,
        additionalPersonnel: 0,
        note: null,
      }),
    ).toEqual({
      error: "Die Stärke muss aus ganzen Zahlen von 0 bis 9999 bestehen.",
    });
  });

  it("reports the Gesamtstärke in the name of the logged-in user", async () => {
    await loginAs("clara");
    const op = await anOperation();
    await createStationAction(op.id, "UHSt 3");
    const db = state.db as Db;
    const [station] = await listStations(db, op.id);
    await recordStrengthReportAction(station.id, {
      leaders: 0,
      subLeaders: 1,
      crew: 6,
      additionalPersonnel: 2,
      note: null,
    });

    expect(await reportTotalStrengthAction(op.id)).toEqual({});

    expect((await listEntries(db, op.id)).at(-1)).toMatchObject({
      type: "gesamtstärke-gemeldet",
      text: expect.stringMatching(
        /^Gesamtstärke gemeldet: 0\/1\/6\/\/7, \+2 zusätzlich, 9 Personen \(1 Stelle, älteste Meldung \d\d:\d\d\)$/,
      ),
      author: "clara",
    });
  });

  it("reports a Gesamtstärke without any report as a form error", async () => {
    await loginAs("clara");
    const op = await anOperation();

    expect(await reportTotalStrengthAction(op.id)).toEqual({
      error: "Es gibt noch keine gültige Stärkemeldung.",
    });
  });

  it("corrects a Stärkemeldung in the name of the logged-in user", async () => {
    await loginAs("clara");
    const op = await anOperation();
    await createStationAction(op.id, "UHSt 3");
    const db = state.db as Db;
    const [station] = await listStations(db, op.id);
    const values = {
      leaders: 0,
      subLeaders: 1,
      crew: 6,
      additionalPersonnel: 2,
      note: null,
    };
    await recordStrengthReportAction(station.id, values);
    const [report] = await listStrengthReports(db, op.id);

    expect(
      await correctStrengthReportAction(report.id, station.id, {
        ...values,
        crew: 5,
      }),
    ).toEqual({});

    expect((await listStrengthReports(db, op.id))[0].crew).toBe(5);
    expect((await listEntries(db, op.id)).at(-1)).toMatchObject({
      text: "Stärkemeldung UHSt 3: 0/1/5//6, +2 zusätzlich, 8 Personen",
      author: "clara",
    });
  });

  it("annuls a Stärkemeldung", async () => {
    await loginAs("clara");
    const op = await anOperation();
    await createStationAction(op.id, "UHSt 3");
    const db = state.db as Db;
    const [station] = await listStations(db, op.id);
    await recordStrengthReportAction(station.id, {
      leaders: 0,
      subLeaders: 1,
      crew: 6,
      additionalPersonnel: 2,
      note: null,
    });
    const [report] = await listStrengthReports(db, op.id);

    expect(await annulStrengthReportAction(report.id)).toEqual({});

    expect((await listStrengthReports(db, op.id))[0].state).toBe("annulliert");
  });

  describe("reach every open Führungsansicht of the operation live", () => {
    it.each([
      [
        "creating a Stelle",
        (s: { operationId: string }) =>
          createStationAction(s.operationId, "Ziel"),
      ],
      [
        "renaming a Stelle",
        (s: { stationId: string }) =>
          renameStationAction(s.stationId, "UHSt 3 Nord"),
      ],
      [
        "recording a Stärkemeldung",
        (s: { stationId: string }) =>
          recordStrengthReportAction(s.stationId, SOME_VALUES),
      ],
      [
        "correcting a Stärkemeldung",
        (s: { reportId: string; stationId: string }) =>
          correctStrengthReportAction(s.reportId, s.stationId, {
            ...SOME_VALUES,
            crew: 5,
          }),
      ],
      [
        "annulling a Stärkemeldung",
        (s: { reportId: string }) => annulStrengthReportAction(s.reportId),
      ],
      [
        "reporting the Gesamtstärke",
        (s: { operationId: string }) =>
          reportTotalStrengthAction(s.operationId),
      ],
    ])("%s", async (_, act) => {
      await loginAs("dora");
      const setting = await aStationWithAReport();

      expect(
        await liveEventsFor(setting.operationId, async () =>
          expect(await act(setting)).toEqual({}),
        ),
      ).toBe(1);
    });

    it("but not those of another operation", async () => {
      await loginAs("dora");
      const setting = await aStationWithAReport();
      const other = await anOperation();

      expect(
        await liveEventsFor(other.id, () =>
          recordStrengthReportAction(setting.stationId, SOME_VALUES),
        ),
      ).toBe(0);
    });
  });
});
