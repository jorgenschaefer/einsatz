---
solution:  02-SOLUTION.md
satisfies: AC-11
after:     04-verlauf-der-stelle, 05-summenverlauf
status:    done
attempts:  1
---

## Build
A Stärkemeldung can be corrected from its Verlauf row; the ETB entry keeps the previous version struck through.

## Done when
> **AC-11** Eine Meldung lässt sich korrigieren. Ändern lassen sich Stelle, Werte und Notiz, die Uhrzeit bleibt. Danach zeigen AC-6 bis AC-10 überall die korrigierten Werte, auch in früheren Zeilen des Summenverlaufs, und die Meldung steht einmal im Verlauf ihrer (neuen) Stelle. Ihr ETB-Eintrag wird korrigiert wie ein Handeintrag heute: Die bisherige Fassung bleibt durchgestrichen mit Urheber und Zeit stehen, die neue Fassung im Format aus AC-5 (mit dem Stellennamen zum Zeitpunkt der Korrektur) wird zur aktuellen, mit „korrigiert hh:mm". Nummer und Zeitstempel des Eintrags bleiben.

> **Gleichzeitige Korrekturen derselben Meldung:** Sie laufen nacheinander (Zeilensperre). Beide hinterlassen eine Fassung am ETB-Eintrag; die spätere gilt.

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

(06 owns the Verlauf row „⋯" menu and the journal.ts tx-level extraction; 07 comes after 06 and only adds to both.)

## Plan
1. `journal.ts`: extract the revision write of `correctEntry` into an exported
   tx-level `reviseEntry(tx, entryId, text, author)` that locks the entry row (FOR
   UPDATE) and writes the old fassung; `correctEntry` keeps its manuell-only check.
   Existing journal-history tests stay green.
2. `strength-reports.ts` `correctStrengthReport(db, {reportId, targetStationId, values,
   author})`: validates values with `assertStrengthValues` and trims the note like
   `recordStrengthReport`; transaction; lock the entry row; reject if annulled; the target Stelle
   must belong to the same operation (`WHERE id = $1 AND operation_id = $2`); update
   the report row; `reviseEntry` with `formatStrengthReportText(current Station name,
   values)`. Tests: values/Stelle changed, time/number unchanged, revision kept with
   author/time, foreign-operation Stelle rejected, annulled rejected, invalid values rejected, closed operation accepted, two concurrent
   corrections both leave a fassung and the later wins.
3. `correctStrengthReportAction`; auth test.
4. `StrengthPanel`: Verlauf row „⋯" menu (new) with
   „Korrigieren" → the detail's form switches to correction mode with prefilled
   values and a Stelle select, Speichern/Abbrechen. Panel tests.
5. Glossary: **Korrigieren** also for Stärkemeldungen (only in „Stärke").
6. `npm run check`.

## Record

**Criteria → tests**

- **AC-11 – Stelle, Werte und Notiz ändern; Uhrzeit bleibt**
  - `src/server/strength/strength-reports.test.ts` › correctStrengthReport:
    - „changes the values and keeps the time and number"
    - „moves the report to another Stelle and names it as called now". Asserts the new `stationId`. `page.tsx` groups reports by `stationId`, so the report appears once, in its new Stelle's Verlauf.
    - „trims the note and stores an empty one as none"
    - „still corrects once the Gesamteinsatz is closed"
  - Rejections, each writing nothing:
    - „rejects a Stelle of another Gesamteinsatz without writing anything"
    - „rejects an unknown report"
    - „rejects an annulled report without writing anything"
    - „rejects a negative number / more than 9999 without writing anything"
  - Action: `src/app/operations/[id]/strength-actions.test.ts` „corrects a Stärkemeldung in the name of the logged-in user". Auth: `src/app/auth-enforcement.test.ts` entry `correctStrengthReportAction`.
  - UI: `src/strength/StrengthPanel.test.tsx` › correcting a report:
    - „prefills the chosen report and its Stelle"
    - „saves the corrected values and Stelle and goes back to the new report"
    - „cancels without saving"
    - „keeps a started new report while correcting"
    - „prefills the new report afresh after a correction"
    - „tells apart two reports of the same minute"
    - „shows a returned error and keeps the correction open"
- **AC-11 – AC-6 bis AC-10 zeigen überall die korrigierten Werte, auch in früheren Summenverlauf-Zeilen.** This follows from the structure: Karte, Summe, Veraltung, Verlauf and Summenverlauf are all computed on the client from the current report rows (`listStrengthReports`). The correction updates those rows in place. No history is stored separately, so there is nothing that could keep the old values. The existing `strength.test.ts` tests pin the computations. No separate test.
- **AC-11 – ETB-Eintrag korrigiert wie ein Handeintrag.** Covered by „corrects the ETB entry and keeps the prior fassung with its author and time": number and `createdAt` unchanged, new text in the AC-5 format, prior fassung kept with its author and time, `editedAt` set. The Stellenname used is the one at correction time:
  - „moves the report … names it as called now" (after a rename)
  - „names the Stelle as renamed by a rename it had to wait for"

  The ETB already shows struck-through revisions and „korrigiert hh:mm" for every entry type (`JournalPanel.tsx`), so no ETB change was needed.
- **Gleichzeitige Korrekturen.** Covered by „runs concurrent corrections one after the other; both leave a fassung and the later wins". The test holds the ETB entry's row lock while it starts both corrections. I proved it by mutation: without the operation lock and the `FOR UPDATE`, and with the revision written before the report update, it fails with two copies of the original fassung.
- **`reviseEntry` extraction.** The existing `journal-history.test.ts` tests stay green. Added „rejects correcting an unknown entry" to pin `correctEntry`'s not-found path.

**Command:** `docker compose -f docker-compose.test.yml up -d && npm run check`. tsc and biome clean, vitest 112 files / 999 tests passed.

**Departures from the plan**

- **Locking.** `correctStrengthReport` locks the operation row first, then the entry row (via `reviseEntry`). The plan only locked the entry row. Locking the operation first is the same order as `recordStrengthReport` and `reportTotalStrength`, so a rename the correction waited for shows up in its text, and a Gesamtstärke never sees half a correction.
- **Test-first.** The plan's validation name `assertStrengthValues` is really `requireStrengthValues`, and that is what I reused. Several rejection tests passed on first run because the code they needed already existed:
  - invalid values, annulled report: I proved these by mutation (removing the validation, removing `assertValid`) and they turned red.
  - the closed-operation test: it pins the absence of a check, so no mutation can make it fail.
  - „rejects correcting an unknown entry": it pins behaviour that existed before the refactor that followed it.
- **The correction form.** It has no „Zurück". Its heading reads „<Stelle> · Meldung hh:mm korrigieren", with a native select „Stelle" (`NativeSelect`, to get the phone's own picker). While it is open, the „neue Meldung" form stays mounted but hidden:
  - after Abbrechen, a started report is still there
  - after a successful correction it is prefilled afresh
- **Verlauf rows.** The „⋯" button is labelled „Aktionen für Meldung hh:mm (#n)" so that two reports from the same minute can be told apart. The table got an extra, unlabelled column for it.
- **Glossary.** **Korrigieren** now also covers Stärkemeldungen (only from the Verlauf, `correctStrengthReport`).

**Review:** two fresh-context rounds.
- Round 1 had no blockers and no should-fix, and three nits, all fixed: the started report getting lost, duplicate button labels, and the not-found path in `correctEntry`. I did not take the tradeoff it offered (reuse `loadStation`): the same-operation check stays in the query's WHERE clause.
- Round 2 found one should-fix, which the nit fix itself had caused: the new-report form kept stale values after a correction. Fixed and tested. No third round (the skill allows two).

**Left standing**

- After a successful correction, the „neue Meldung" form is prefilled afresh, so anything typed there before the correction is lost. It survives only Abbrechen. The fresh prefill relies on the refreshed props arriving with the action's response, as `revalidatePath` does in Next.
- A malformed (non-UUID) `reportId` produces a Postgres error rather than a form error. `recordStrengthReport` does the same with a bad `stationId`. Only a hand-crafted request can trigger it.
- `correctEntry` now reports „Nur manuelle …" rather than „Annullierte …" for an entry that is both annulled and non-manual. No caller depends on which one it gets.
- Not checked in a real browser: where the menu opens inside the table, focus after Korrigieren/Abbrechen, and the 360 px layout of the correction form (ticket 10). `page.tsx` and `SituationWorkspace` wiring is covered only by `tsc`.
- In round 2, the reviewer's own run of the check had one timeout in `SituationWorkspace.test.tsx` („places a composition built in the Erweitert form …"). The file passes alone, and my final run was green. This is the same load sensitivity recorded in tickets 01–03.
