---
solution:  02-SOLUTION.md
satisfies: AC-11
after:     04-verlauf-der-stelle, 05-summenverlauf
status:    ready
attempts:  0
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
