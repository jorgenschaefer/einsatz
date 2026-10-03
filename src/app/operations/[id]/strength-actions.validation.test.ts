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

import { listStations } from "@/server/strength/stations";
import { listStrengthReports } from "@/server/strength/strength-reports";
import type { StrengthValues } from "@/strength/strength";
import { freshDb } from "@/test/db";
import {
  aJournalAndStrength,
  type JournalAndStrength,
  journalAndStrength,
} from "@/test/journal-and-strength";
import { signIn } from "@/test/sign-in";
import {
  annulStrengthReportAction,
  correctStrengthReportAction,
  createStationAction,
  recordStrengthReportAction,
  renameStationAction,
  reportTotalStrengthAction,
} from "./strength-actions";

// Server Actions nehmen, was der Client schickt – die Typen hier lügen absichtlich.
// biome-ignore lint/suspicious/noExplicitAny: bewusst falsch getypte Eingaben
type Bad = any;

type Call = (o: JournalAndStrength) => Promise<ActionResult>;

const INVALID_ID = "Ungültige ID.";
const NOT_A_UUID = "op-1";
const VALUES: StrengthValues = {
  leaders: 1,
  subLeaders: 2,
  crew: 9,
  additionalPersonnel: 0,
  note: "Funk gestört",
};

const longText = (length: number) => "x".repeat(length);

/** Beide Wege, einer Stelle einen Namen zu geben: anlegen und umbenennen. */
const namings: [
  string,
  (o: JournalAndStrength, name: Bad) => Promise<ActionResult>,
][] = [
  ["a new Stelle", (o, name) => createStationAction(o.operationId, name)],
  ["renaming a Stelle", (o, name) => renameStationAction(o.stationId, name)],
];

/** Beide Wege, Werte zu melden: erfassen und korrigieren. */
const reportings: [
  string,
  (o: JournalAndStrength, values: Bad) => Promise<ActionResult>,
][] = [
  [
    "a new Stärkemeldung",
    (o, values) => recordStrengthReportAction(o.stationId, values),
  ],
  [
    "a corrected Stärkemeldung",
    (o, values) => correctStrengthReportAction(o.reportId, o.stationId, values),
  ],
];

const badNames: [string, string, unknown][] = [
  ["a name as a number", "Der Name der Stelle muss Text sein.", 7],
  [
    "a name of 201 characters",
    "Der Name der Stelle darf höchstens 200 Zeichen lang sein.",
    longText(201),
  ],
];

const badValues: [string, string, unknown][] = [
  [
    "values null",
    "Die Stärke muss aus ganzen Zahlen von 0 bis 9999 bestehen.",
    null,
  ],
  [
    "values as text",
    "Die Stärke muss aus ganzen Zahlen von 0 bis 9999 bestehen.",
    "0/1/6",
  ],
  ["a note as a number", "Die Notiz muss Text sein.", { ...VALUES, note: 7 }],
  [
    "a note of 2,001 characters",
    "Die Notiz darf höchstens 2.000 Zeichen lang sein.",
    { ...VALUES, note: longText(2001) },
  ],
];

const badCalls: [string, string, Call][] = [
  [
    "a new Stelle with an Einsatz-ID that is not a UUID",
    INVALID_ID,
    () => createStationAction(NOT_A_UUID, "UHSt 4"),
  ],
  [
    "renaming a Stelle with a Stellen-ID that is not a UUID",
    INVALID_ID,
    () => renameStationAction(NOT_A_UUID, "UHSt 4"),
  ],
  [
    "a new Stärkemeldung with a Stellen-ID that is not a UUID",
    INVALID_ID,
    () => recordStrengthReportAction(NOT_A_UUID, VALUES),
  ],
  [
    "a corrected Stärkemeldung with a Meldungs-ID that is not a UUID",
    INVALID_ID,
    (o) => correctStrengthReportAction(NOT_A_UUID, o.stationId, VALUES),
  ],
  [
    "a corrected Stärkemeldung with a Stellen-ID that is not a UUID",
    INVALID_ID,
    (o) => correctStrengthReportAction(o.reportId, NOT_A_UUID, VALUES),
  ],
  [
    "annulling a Stärkemeldung with a Meldungs-ID that is not a UUID",
    INVALID_ID,
    () => annulStrengthReportAction(NOT_A_UUID),
  ],
  [
    "the Gesamtstärke with an Einsatz-ID that is not a UUID",
    INVALID_ID,
    () => reportTotalStrengthAction(NOT_A_UUID),
  ],
  ...namings.flatMap(([naming, call]) =>
    badNames.map(([what, error, name]): [string, string, Call] => [
      `${naming} with ${what}`,
      error,
      (o) => call(o, name),
    ]),
  ),
  ...reportings.flatMap(([reporting, call]) =>
    badValues.map(([what, error, values]): [string, string, Call] => [
      `${reporting} with ${what}`,
      error,
      (o) => call(o, values),
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

describe.each(namings)("%s with the longest name allowed", (_, call) => {
  it("stores a name of 200 characters, trimmed of surrounding blanks", async () => {
    const o = await aJournalAndStrength(state.db as Db);
    const name = longText(200);

    expect(await call(o, ` ${name} `)).toEqual({});

    expect(await listStations(state.db as Db, o.operationId)).toContainEqual(
      expect.objectContaining({ name }),
    );
  });
});

describe.each(reportings)("%s with the longest note allowed", (_, call) => {
  it("stores a note of 2,000 characters, trimmed of surrounding blanks", async () => {
    const o = await aJournalAndStrength(state.db as Db);
    const note = longText(2000);

    expect(await call(o, { ...VALUES, note: ` ${note}\n` })).toEqual({});

    expect(
      await listStrengthReports(state.db as Db, o.operationId),
    ).toContainEqual(expect.objectContaining({ note }));
  });
});
