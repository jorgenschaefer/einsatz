import {
  addJournalEntryAction,
  annulEntryAction,
  correctEntryAction,
} from "@/app/operations/[id]/journal-actions";
import {
  annulStrengthReportAction,
  correctStrengthReportAction,
  createStationAction,
  recordStrengthReportAction,
  renameStationAction,
  reportTotalStrengthAction,
} from "@/app/operations/[id]/strength-actions";
import {
  type Bad,
  type BadCall,
  type BadCalls,
  INVALID_ID,
  NOT_A_UUID,
  rejects,
  text,
  tooLong,
} from "./bad-call";
import { ENTRY, type Fixture, VALUES } from "./fixture";

/** Die ETB- und Stärke-Actions mit falschen Eingaben (AC-22). */
export const JOURNAL_STRENGTH_BAD_CALLS: BadCalls = {
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
  createStationAction: [
    rejects("a non-UUID Einsatz-ID", INVALID_ID, () =>
      createStationAction(NOT_A_UUID, "UHSt 2"),
    ),
    ...stationNameCalls((f, name) => createStationAction(f.operationId, name)),
  ],
  renameStationAction: [
    rejects("a non-UUID Stellen-ID", INVALID_ID, () =>
      renameStationAction(NOT_A_UUID, "UHSt 2"),
    ),
    ...stationNameCalls((f, name) => renameStationAction(f.stationId, name)),
  ],
  recordStrengthReportAction: [
    rejects("a non-UUID Stellen-ID", INVALID_ID, () =>
      recordStrengthReportAction(NOT_A_UUID, VALUES),
    ),
    ...strengthValuesCalls((f, values) =>
      recordStrengthReportAction(f.stationId, values),
    ),
  ],
  correctStrengthReportAction: [
    rejects("a non-UUID Meldungs-ID", INVALID_ID, (f) =>
      correctStrengthReportAction(NOT_A_UUID, f.stationId, VALUES),
    ),
    rejects("a non-UUID Stellen-ID", INVALID_ID, (f) =>
      correctStrengthReportAction(f.reportId, NOT_A_UUID, VALUES),
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
};

function entryContentCalls(
  action: (f: Fixture, content: Bad) => Promise<unknown>,
): BadCall[] {
  return [
    rejects("content of null", "Ungültiger ETB-Eintrag.", (f) =>
      action(f, null),
    ),
    rejects("a text as a number", "Der Text muss Text sein.", (f) =>
      action(f, { ...ENTRY, text: 7 }),
    ),
    rejects("a text of 10,001", tooLong("Der Text", "10.000"), (f) =>
      action(f, { ...ENTRY, text: text(10_001) }),
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
    rejects("a Weg of 201", tooLong("Der Weg", "200"), (f) =>
      action(f, { ...ENTRY, channel: text(201) }),
    ),
  ];
}

function stationNameCalls(
  action: (f: Fixture, name: Bad) => Promise<unknown>,
): BadCall[] {
  return [
    rejects("a name of null", "Der Name der Stelle muss Text sein.", (f) =>
      action(f, null),
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
    rejects("values as text", INVALID_COUNTS, (f) => action(f, "1/2/6")),
    rejects("a count as text", INVALID_COUNTS, (f) =>
      action(f, { ...VALUES, crew: "6" }),
    ),
    rejects("a count of NaN", INVALID_COUNTS, (f) =>
      action(f, { ...VALUES, leaders: Number.NaN }),
    ),
    rejects("a note as a number", "Die Notiz muss Text sein.", (f) =>
      action(f, { ...VALUES, note: 7 }),
    ),
    rejects("a note of 2,001", tooLong("Die Notiz", "2.000"), (f) =>
      action(f, { ...VALUES, note: text(2001) }),
    ),
  ];
}
