---
solution:  02-SOLUTION.md
satisfies: AC-12
after:     06-meldung-korrigieren
status:    done
attempts:  1
---

## Build
A Stärkemeldung can be annulled from its Verlauf row after a confirmation modal; it drops out of every view and its ETB entry is struck through.

## Done when
> **AC-12** Eine Meldung lässt sich annullieren, z. B. wenn sie versehentlich erfasst wurde. Wie im ETB fragt vorher ein Modal nach der Bestätigung. Danach fällt sie aus AC-6 bis AC-10 heraus. Ihr ETB-Eintrag wird annulliert wie ein Handeintrag heute: Er bleibt mit Nummer und Text durchgestrichen stehen. Eine annullierte Meldung lässt sich weder korrigieren noch wiederherstellen.

## Context
From the solution (settled, do not re-decide):

- A **Stelle** belongs to one Gesamteinsatz (`Operation`) and is only a name - no location, no map symbol.
- A **Stärkemeldung** stores Führer, Unterführer, Helfer, zusätzliches Personal and an optional Notiz, plus a reference to the ETB entry that records it. Σ (Führer + Unterführer + Helfer) and Gesamtpersonen (Σ + zusätzliches Personal) are never stored, always computed. The report has no time or state of its own: time is its ETB entry's `created_at`, valid/annulled is the entry's `state`, order is the entry's `number`. Report and entry are written in the same transaction. A correction updates the report row directly and corrects the ETB entry in the same transaction via the existing revision mechanism (`journal_entry_revisions`); there is no revision table for reports. Both foreign keys (Stelle → Einsatz, Meldung → Stelle) and the reference to the ETB entry cascade on delete, so `deleteOperation` keeps working.
- New `JournalEntryType` values (in `src/server/journal/journal.ts` and the copy in `JournalPanel.tsx`): `stelle-angelegt`, `stelle-umbenannt`, `stärkemeldung`, `gesamtstärke-gemeldet` - each added by the ticket that first writes it. „Automatisch" stays only `einsatz-eröffnet` and `einsatz-geschlossen`: the Stärke entries carry no „automatisch" badge and „Automatische ausblenden" does not hide them. In the ETB only `manuell` is correctable; `manuell` and `gesamtstärke-gemeldet` are annullable (so a `gesamtstärke-gemeldet` entry's „⋯" menu has only „Annullieren …"). `stärkemeldung` entries are changed only from the view „Stärke" (no „⋯" in the ETB); Stelle entries are untouchable.
- „Stärke" is the third item of the main view bar (`MainViewBar`, after Lagekarte and ETB): bottom bar on the phone, left bar on the desktop. Like the other two views it stays mounted while switching, so a half-filled report form survives.
- The view is used on a smartphone (360 px); build every screen mobile-first even where the 360 px check belongs to ticket 10.
- Every change goes through `operationAction` (`src/app/operations/[id]/operation-action.ts`), which revalidates the page and publishes the SSE event; the page reloads via `router.refresh()`.
- Mockup: `../specimens/B-stellen-mit-meldungen.html`.

Decisions taken when slicing (planner's call, approved with the slicing):

- **English identifiers (confirmed by the user, glossary gets them):**
  Stelle → `Station` (table `stations`); Stärkemeldung → `StrengthReport` (table
  `strength_reports`); Führer/Unterführer/Helfer → `leaders`/`subLeaders`/`helpers`;
  zusätzliches Personal → `additionalPersonnel`; Σ → `sum`; Gesamtpersonen →
  `totalPersons`; Summe über die Stellen → `Total` (`totalOf`); „Gesamtstärke melden" →
  `reportTotalStrength`; Verlauf → `history`; Summenverlauf → `totalHistory`;
  Gesamteinsatz → existing `Operation`; main view id `"strength"`.
- **Layout:** pure, shared logic (types, Σ/Gesamtpersonen, ETB text format, latest
  report, sum, staleness, histories) in new `src/strength/strength.ts` - imported by
  both server and client, like `src/server/areas/areas.ts` imports `@/map/area`.
  UI in new `src/strength/StrengthPanel.tsx`. Server in new `src/server/strength/`.
  Actions in new `src/app/operations/[id]/strength-actions.ts`, all through
  `operationAction` (which revalidates + publishes the SSE event), each added to
  `src/app/auth-enforcement.test.ts`.
- **Data flow:** `page.tsx` loads Stellen and their reports (with time/state/number
  joined from `journal_entries`) and passes them as props through
  `SituationWorkspace` to `StrengthPanel`; SSE → `router.refresh()` re-renders them
  (existing mechanism). The client computes latest/sum/staleness/histories with the
  pure functions (staleness needs the ticking `useStalenessClock`).
- **In-pane navigation, no modal** for the Stelle detail (form + Verlauf) and the
  Summenverlauf: the Stärke pane holds `selectedStationId` / `showTotalHistory` state and
  a back button, so switching main views keeps a half-filled form (Approach: "bleibt
  beim Wechsel eingehängt"). A Modal would portal over the MainViewBar.
- **Verlauf rows get a „⋯" menu** (Korrigieren / Annullieren …) mirroring the ETB,
  instead of the mockup's ✎ - two actions need two entry points.
- **Times** shown as `HH:mm` Europe/Berlin (`Intl.DateTimeFormat`, as `JournalPanel`);
  the server formats the AC-13 text the same way.
- No ADR: every choice here is enforced by a test or visible in the schema.

## Plan
`journal.ts` exported tx-level `markEntryAnnulled(tx, entryId)` used by
`annulEntry`; `strength-reports.ts` `annulStrengthReport(db, reportId)` - transaction,
locks the entry row `FOR UPDATE` (06's helper), rejects when already annulled + tests
(incl. closed operation accepted, annulled report rejected by `correctStrengthReport`);
the „⋯" menu from 06 gains the item; action + auth test; Verlauf row „⋯" → „Annullieren …" →
confirmation Modal like `JournalPanel`; panel test that it drops out of card, sum,
Verlauf, Summenverlauf and has no further menu. Glossary: **Annullieren** for
Stärkemeldungen. `npm run check`.

## Record

**Criteria → tests**

- **AC-12 – Eine Meldung lässt sich annullieren.**
  - `src/server/strength/strength-reports.test.ts` › annulStrengthReport:
    - „annuls the report and keeps its ETB entry with number and text": the report lists as `annulliert`, and its ETB entry is unchanged except for `state`.
    - „rejects an annulled report without writing anything" (proved by mutation: without `assertValid` in `markEntryAnnulled` it resolves)
    - „rejects an unknown report" (proved by mutation: without the not-found check it throws a plain `Error`)
    - „still annuls once the Gesamteinsatz is closed" (pins the absence of a check, like correcting and recording)
  - Action: `src/app/operations/[id]/strength-actions.test.ts` „annuls a Stärkemeldung". Auth: `src/app/auth-enforcement.test.ts` entry `annulStrengthReportAction` (proved by mutation: an action without `operationAction` fails it).
- **AC-12 – Wie im ETB fragt vorher ein Modal.** `src/strength/StrengthPanel.test.tsx` › annulling a report:
  - „offers it after Korrigieren in the report's menu"
  - „asks for confirmation and annuls only once confirmed" (the title names Stelle, time and ETB number: „UHSt 3 · Meldung 11:30 (#7) annullieren")
  - „keeps the report when the confirmation is cancelled"
  - „annuls only once on a double click"
  - „shows a returned error"
  - „shows a failed annulment as an error"
- **AC-12 – fällt aus AC-6 bis AC-10 heraus.** This already follows from the structure: card, Summe, Veraltung, Verlauf and Summenverlauf all go through `stationHistory`/`latestValidReport`/`totalOf`, which keep only `gueltig` reports. It is already pinned by the existing tests „skips an annulled latest report" (card), „leaves out annulled reports" and „is not shown without a valid report" (Verlauf), „shows no table once its last valid report is annulled" (Summenverlauf), and the `strength.test.ts` tests for `totalOf`/`totalHistory`. Also added „prefills the new report afresh after an annulment", so the form above the Verlauf does not keep the annulled values either.
- **AC-12 – ETB-Eintrag annulliert wie ein Handeintrag.** Covered by the first server test (number and text kept, `state = annulliert`). The ETB already renders any `annulliert` entry struck through (`JournalPanel.tsx`), whatever its type, so no ETB change was needed. `stärkemeldung` entries still have no „⋯" there.
- **AC-12 – weder korrigieren noch wiederherstellen.**
  - Correcting: „rejects an annulled report without writing anything" under correctStrengthReport now annuls through `annulStrengthReport` instead of raw SQL. In the UI, „closes the correction of a report once it is annulled": the open correction is looked up among valid reports only.
  - Restoring: nothing to build, since no restore exists anywhere.
- **`markEntryAnnulled` extraction.** The `journal-history.test.ts` annulEntry tests stay green. Added „rejects annulling an unknown entry" to pin the not-found branch that moved into `annulEntry`. It passed on first run because it pins behaviour that existed before the refactor.

**Command:** `docker compose -f docker-compose.test.yml up -d && npm run check`.
- Before the two review fixes: fully green (tsc, biome, vitest 112 files / 1013 tests).
- After the fixes, which touched only `StrengthPanel.tsx` and its test: tsc and biome are clean and `StrengthPanel.test.tsx` passes 63/63. The full run then failed three times, only on 5 s timeouts in `src/map/SituationWorkspace.test.tsx`, with a different set each time (1, 3, 14 tests). The machine's load average was 9–14 from other sessions' dev servers. That file passes 131/131 on its own. Its only change here is one added default prop. This is the load sensitivity recorded in tickets 01–03 and 06, so I did not treat it as a mystery. I did not get a green full run on the final revision.

**Departures from the plan**

- **`annulEntry`.** It now checks the entry's type with a plain SELECT, like `correctEntry`, and then calls `markEntryAnnulled`, which does the lock and the validity check. An already-annulled non-annullable entry now gets „Dieser Eintrag kann nicht annulliert werden." rather than „Annullierte …". Both are rejections.
- **Lock order.** `annulStrengthReport` locks only the ETB entry row (`FOR UPDATE`, through `markEntryAnnulled`), as the plan says, and not the Einsatz row.
- **Glossary.** **Annullieren** now also covers Stärkemeldungen (from the Verlauf only, `annulStrengthReport`).

**Review:** two fresh-context rounds (a first attempt died on a usage limit before reporting and was redone).
- **Round 1** had one blocker: after an annulment the „neue Meldung" form kept the annulled values, so „Melden" would re-record them. Fixed test-first by remounting the form as after a correction. It also had two nits. I fixed the first: the modal title now carries the ETB number, because two reports can share a minute. I left the second: see below.
- **Round 2** had no blockers and one should-fix, which I declined:
  - It asked for `annulStrengthReport` to also take the Einsatz lock, so that it serializes with „Gesamtstärke melden".
  - Why I declined: an annulment writes no ETB entry and has no time of its own. A Gesamtstärke that read the report before the annulment committed is indistinguishable from one that ran just before it. The lock would change nothing a user can observe. `correctStrengthReport` needs the lock for a different reason: its new text contains the Stellenname.
  - Round 2 also had two nits, both left (below), and a tradeoff, also left (below).

**Left standing**

- **Unpinned guard.** `annul()` guards on `!annulConfirmationOpen`, mirroring `JournalPanel`, and no test pins it. It matters only for a click during the modal's close animation. The double click is pinned by `loading`.
- **Undefined title.** The modal title would read „undefined · …" if the selected Stelle vanished while the modal is open. That is unreachable: the modal blocks input, and Stellen cannot be deleted.
- **Discarded input (tradeoff not taken).** A successful annulment re-prefills the „neue Meldung" form, which discards anything typed there, the same as after a correction. The alternative was to re-prefill only an untouched form, at the cost of extra state.
- **Duplicated confirmation.** The confirmation state and Modal duplicate about 40 lines of `JournalPanel`. Not shared, because there are only two users and the texts differ.
- **Not checked in a real browser:** the modal's look, focus return, and the menu's position inside the table. 360 px belongs to ticket 10.
