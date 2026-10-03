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
import { listEntries } from "@/server/journal/journal";
import { insertOperation } from "@/server/operations/operations";
import { listStations } from "@/server/strength/stations";
import { listStrengthReports } from "@/server/strength/strength-reports";
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
import type { Fixture } from "@/test/bad-calls/fixture";
import { freshDb } from "@/test/db";
import {
  aJournalAndStrength,
  type JournalAndStrength,
} from "@/test/journal-and-strength";
import { liveEventsFor } from "@/test/live-events";
import { signIn, signInAs } from "@/test/sign-in";
import * as actions from "./strength-actions";

const {
  annulStrengthReportAction,
  correctStrengthReportAction,
  createStationAction,
  recordStrengthReportAction,
  renameStationAction,
  reportTotalStrengthAction,
} = actions;

const SOME_VALUES = {
  leaders: 0,
  subLeaders: 1,
  crew: 6,
  additionalPersonnel: 2,
  note: null,
};

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
    createStationAction: [
      rejects("a non-UUID Einsatz-ID", INVALID_ID, () =>
        createStationAction(NOT_A_UUID, "UHSt 2"),
      ),
      ...stationNameCalls((f, name) =>
        createStationAction(f.operationId, name),
      ),
    ],
    renameStationAction: [
      rejects("a non-UUID Stellen-ID", INVALID_ID, () =>
        renameStationAction(NOT_A_UUID, "UHSt 2"),
      ),
      ...stationNameCalls((f, name) => renameStationAction(f.stationId, name)),
    ],
    recordStrengthReportAction: [
      rejects("a non-UUID Stellen-ID", INVALID_ID, () =>
        recordStrengthReportAction(NOT_A_UUID, SOME_VALUES),
      ),
      ...strengthValuesCalls((f, values) =>
        recordStrengthReportAction(f.stationId, values),
      ),
    ],
    correctStrengthReportAction: [
      rejects("a non-UUID Meldungs-ID", INVALID_ID, (f) =>
        correctStrengthReportAction(NOT_A_UUID, f.stationId, SOME_VALUES),
      ),
      rejects("a non-UUID Stellen-ID", INVALID_ID, (f) =>
        correctStrengthReportAction(f.reportId, NOT_A_UUID, SOME_VALUES),
      ),
      ...strengthValuesCalls((f, values) =>
        correctStrengthReportAction(f.reportId, f.stationId, values),
      ),
    ],
    annulStrengthReportAction: [
      rejects("a non-UUID Meldungs-ID", INVALID_ID, () =>
        annulStrengthReportAction(NOT_A_UUID),
      ),
    ],
    reportTotalStrengthAction: [
      rejects("a non-UUID Einsatz-ID", INVALID_ID, () =>
        reportTotalStrengthAction(NOT_A_UUID),
      ),
    ],
  },
  { db, actAs },
);

expectForeignObjectsRejected(
  actions,
  {
    createStationAction: "takes only the Einsatz-ID",
    reportTotalStrengthAction: "takes only the Einsatz-ID",
    renameStationAction: "takes no Einsatz-ID",
    recordStrengthReportAction: "takes no Einsatz-ID",
    correctStrengthReportAction: "takes no Einsatz-ID",
    annulStrengthReportAction: "takes no Einsatz-ID",
  },
  { db, actAs },
);

describe("strength actions", () => {
  it("creates a Stelle in the name of the logged-in user", async () => {
    state.token = await signInAs(db(), "anna");
    const op = await anOperation();

    expect(await createStationAction(op.id, "UHSt 3")).toEqual({});

    expect((await listStations(db(), op.id)).map((s) => s.name)).toEqual([
      "UHSt 3",
    ]);
    expect(await listEntries(db(), op.id)).toEqual([
      expect.objectContaining({
        text: "Stelle angelegt: UHSt 3",
        author: "anna",
      }),
    ]);
  });

  it("reports a duplicate name as a form error", async () => {
    state.token = await signInAs(db(), "anna");
    const { operationId } = await aStation();

    expect(await createStationAction(operationId, "uhst 3")).toEqual({
      error: "Eine Stelle mit diesem Namen gibt es schon.",
    });
  });

  it("renames a Stelle in the name of the logged-in user", async () => {
    state.token = await signInAs(db(), "bernd");
    const { operationId, stationId } = await aStation();

    expect(await renameStationAction(stationId, "UHSt 3 Nord")).toEqual({});

    expect((await listStations(db(), operationId)).map((s) => s.name)).toEqual([
      "UHSt 3 Nord",
    ]);
    expect((await listEntries(db(), operationId)).at(-1)).toMatchObject({
      text: "Stelle umbenannt: UHSt 3 → UHSt 3 Nord",
      author: "bernd",
    });
  });

  it("reports an empty new name as a form error", async () => {
    state.token = await signInAs(db(), "bernd");
    const { stationId } = await aStation();

    expect(await renameStationAction(stationId, " ")).toEqual({
      error: "Der Name der Stelle darf nicht leer sein.",
    });
  });

  it("records a Stärkemeldung in the name of the logged-in user", async () => {
    state.token = await signInAs(db(), "bernd");
    const { operationId, stationId } = await aStation();

    expect(await recordStrengthReportAction(stationId, SOME_VALUES)).toEqual(
      {},
    );

    expect(await listStrengthReports(db(), operationId)).toEqual([
      expect.objectContaining(SOME_VALUES),
    ]);
    expect((await listEntries(db(), operationId)).at(-1)).toMatchObject({
      text: "Stärkemeldung UHSt 3: 0/1/6//7, +2 zusätzlich, 9 Personen",
      author: "bernd",
    });
  });

  it("reports a negative number as a form error", async () => {
    state.token = await signInAs(db(), "bernd");
    const { stationId } = await aStation();

    expect(
      await recordStrengthReportAction(stationId, {
        ...SOME_VALUES,
        leaders: -1,
      }),
    ).toEqual({
      error: "Die Stärke muss aus ganzen Zahlen von 0 bis 9999 bestehen.",
    });
  });

  it("reports the Gesamtstärke in the name of the logged-in user", async () => {
    state.token = await signInAs(db(), "clara");
    const { operationId } = await aStationWithAReport();

    expect(await reportTotalStrengthAction(operationId)).toEqual({});

    expect((await listEntries(db(), operationId)).at(-1)).toMatchObject({
      type: "gesamtstärke-gemeldet",
      text: expect.stringMatching(
        /^Gesamtstärke gemeldet: 0\/1\/6\/\/7, \+2 zusätzlich, 9 Personen \(1 Stelle, älteste Meldung \d\d:\d\d\)$/,
      ),
      author: "clara",
    });
  });

  it("reports a Gesamtstärke without any report as a form error", async () => {
    state.token = await signInAs(db(), "clara");
    const op = await anOperation();

    expect(await reportTotalStrengthAction(op.id)).toEqual({
      error: "Es gibt noch keine gültige Stärkemeldung.",
    });
  });

  it("corrects a Stärkemeldung in the name of the logged-in user", async () => {
    state.token = await signInAs(db(), "clara");
    const { operationId, stationId, reportId } = await aStationWithAReport();

    expect(
      await correctStrengthReportAction(reportId, stationId, {
        ...SOME_VALUES,
        crew: 5,
      }),
    ).toEqual({});

    expect((await listStrengthReports(db(), operationId))[0].crew).toBe(5);
    expect((await listEntries(db(), operationId)).at(-1)).toMatchObject({
      text: "Stärkemeldung UHSt 3: 0/1/5//6, +2 zusätzlich, 8 Personen",
      author: "clara",
    });
  });

  it("annuls a Stärkemeldung", async () => {
    state.token = await signInAs(db(), "clara");
    const { operationId, reportId } = await aStationWithAReport();

    expect(await annulStrengthReportAction(reportId)).toEqual({});

    expect((await listStrengthReports(db(), operationId))[0].state).toBe(
      "annulliert",
    );
  });

  describe("reach every open Führungsansicht of the operation live", () => {
    it.each([
      [
        "creating a Stelle",
        (s: Setting) => createStationAction(s.operationId, "Ziel"),
      ],
      [
        "renaming a Stelle",
        (s: Setting) => renameStationAction(s.stationId, "UHSt 3 Nord"),
      ],
      [
        "recording a Stärkemeldung",
        (s: Setting) => recordStrengthReportAction(s.stationId, SOME_VALUES),
      ],
      [
        "correcting a Stärkemeldung",
        (s: Setting) =>
          correctStrengthReportAction(s.reportId, s.stationId, {
            ...SOME_VALUES,
            crew: 5,
          }),
      ],
      [
        "annulling a Stärkemeldung",
        (s: Setting) => annulStrengthReportAction(s.reportId),
      ],
      [
        "reporting the Gesamtstärke",
        (s: Setting) => reportTotalStrengthAction(s.operationId),
      ],
    ])("%s", async (_, act) => {
      state.token = await signInAs(db(), "dora");
      const setting = await aStationWithAReport();

      expect(
        await liveEventsFor(setting.operationId, async () =>
          expect(await act(setting)).toEqual({}),
        ),
      ).toBe(1);
    });

    it("but not those of another operation", async () => {
      state.token = await signInAs(db(), "dora");
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

describe.each(namings)("%s with the longest name allowed", (_, call) => {
  beforeEach(() => actAs("user"));

  it("stores a name of 200 characters, trimmed of surrounding blanks", async () => {
    const o = await aJournalAndStrength(db());
    const name = text(200);

    expect(await call(o, ` ${name} `)).toEqual({});

    expect(await listStations(db(), o.operationId)).toContainEqual(
      expect.objectContaining({ name }),
    );
  });
});

describe.each(reportings)("%s with the longest note allowed", (_, call) => {
  beforeEach(() => actAs("user"));

  it("stores a note of 2,000 characters, trimmed of surrounding blanks", async () => {
    const o = await aJournalAndStrength(db());
    const note = text(2000);

    expect(await call(o, { ...SOME_VALUES, note: ` ${note}\n` })).toEqual({});

    expect(await listStrengthReports(db(), o.operationId)).toContainEqual(
      expect.objectContaining({ note }),
    );
  });
});

function stationNameCalls(
  action: (f: Fixture, name: Bad) => Promise<unknown>,
): BadCall[] {
  return [
    rejects("a name of null", "Der Name der Stelle muss Text sein.", (f) =>
      action(f, null),
    ),
    rejects("a name as a number", "Der Name der Stelle muss Text sein.", (f) =>
      action(f, 7),
    ),
    rejects("a name of 201", tooLong("Der Name der Stelle", "200"), (f) =>
      action(f, text(201)),
    ),
  ];
}

function strengthValuesCalls(
  action: (f: Fixture, values: Bad) => Promise<unknown>,
): BadCall[] {
  const INVALID_COUNTS =
    "Die Stärke muss aus ganzen Zahlen von 0 bis 9999 bestehen.";
  return [
    rejects("values of null", INVALID_COUNTS, (f) => action(f, null)),
    rejects("values as text", INVALID_COUNTS, (f) => action(f, "1/2/6")),
    rejects("a count as text", INVALID_COUNTS, (f) =>
      action(f, { ...SOME_VALUES, crew: "6" }),
    ),
    rejects("a count of NaN", INVALID_COUNTS, (f) =>
      action(f, { ...SOME_VALUES, leaders: Number.NaN }),
    ),
    rejects("a note as a number", "Die Notiz muss Text sein.", (f) =>
      action(f, { ...SOME_VALUES, note: 7 }),
    ),
    rejects("a note of 2,001", tooLong("Die Notiz", "2.000"), (f) =>
      action(f, { ...SOME_VALUES, note: text(2001) }),
    ),
  ];
}

interface Setting {
  operationId: string;
  stationId: string;
  reportId: string;
}

function anOperation() {
  return insertOperation(db(), { name: "Cyclassics", description: null });
}

/** Ein Einsatz mit der Stelle „UHSt 3“, angelegt vom angemeldeten Nutzer. */
async function aStation() {
  const op = await anOperation();
  await createStationAction(op.id, "UHSt 3");
  const [station] = await listStations(db(), op.id);
  return { operationId: op.id, stationId: station.id };
}

/** {@link aStation} mit einer Stärkemeldung über {@link SOME_VALUES}. */
async function aStationWithAReport(): Promise<Setting> {
  const { operationId, stationId } = await aStation();
  await recordStrengthReportAction(stationId, SOME_VALUES);
  const [report] = await listStrengthReports(db(), operationId);
  return { operationId, stationId, reportId: report.id };
}
