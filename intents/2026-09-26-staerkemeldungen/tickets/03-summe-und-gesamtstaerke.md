---
solution:  02-SOLUTION.md
satisfies: AC-7, AC-8, AC-13, AC-19
after:     02-meldung-erfassen
status:    ready
attempts:  0
---

## Build
The view shows the sum over all Stellen with the time of the oldest included report, highlights stale times, and „Gesamtstärke melden" writes the sum into the ETB.

## Done when
> **AC-7** Die Summe addiert Führer, Unterführer, Helfer, Σ, zusätzliches Personal und Gesamtpersonen über die letzte gültige Meldung jeder Stelle. Stellen ohne gültige Meldung zählen nicht mit.

> **AC-8** Zur Summe steht die Uhrzeit der ältesten Meldung, die in sie eingeht. Ist diese älter als 60 Minuten, wird sie hervorgehoben, ebenso die Uhrzeit jeder Stellenkarte, deren letzte Meldung älter als 60 Minuten ist.

> **AC-13** „Gesamtstärke melden" schreibt den ETB-Eintrag „Gesamtstärke gemeldet: 2/6/25//33, +6 zusätzlich, 39 Personen (4 Stellen, älteste Meldung 10:10)" mit den Werten von AC-7 und AC-8 zu diesem Zeitpunkt; gezählt werden die Stellen, die in die Summe eingehen (AC-7), außer denen nach AC-19. Zählt keine Stelle, entfällt „, älteste Meldung …" („(0 Stellen)"); bei genau einer heißt es „1 Stelle". Die Summe wird erst unter der Einsatzsperre von `appendEntry` berechnet, damit keine parallel eingehende Meldung vor dem Eintrag im ETB steht, ohne in ihm enthalten zu sein. Ohne gültige Meldung ist der Knopf deaktiviert. Ein versehentlich geschriebener Eintrag lässt sich im ETB über sein „⋯"-Menü annullieren.

> **AC-19** Hat die letzte gültige Meldung einer Stelle 0 Gesamtpersonen (z. B. weil die Stelle abgebaut ist), wird ihre Uhrzeit nie als veraltet hervorgehoben. Die Meldung zählt nicht zur ältesten Uhrzeit der Summe (AC-8) und nicht zur Stellenzahl in „Gesamtstärke gemeldet" (AC-13). Meldet die Stelle später wieder Personen, gilt das normale Verhalten.

> **Keine Stellen:** Die Ansicht zeigt nur „Stelle anlegen", keine Summe.

> **Stelle ohne Meldung:** Sie zählt nicht zur Summe und nicht zur ältesten Uhrzeit (AC-7, AC-8).

> **Stelle abgebaut:** Die Führungskraft meldet einmal 0/0/0//0 mit 0 zusätzlichem Personal (AC-19). Die Karte bleibt mit Nullwerten stehen. Vom Nutzer so entschieden; ein Stilllegen mit gespeicherten Zustandswechseln wurde erwogen und als zu aufwendig verworfen.

> **Alle Stellen auf 0:** Die Summe zeigt 0 ohne älteste Uhrzeit. „Gesamtstärke melden" bleibt möglich und meldet 0 Stellen.

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
1. `strength.ts` + tests: `totalOf(stations)` → summed values over each Stelle's
   latest valid report, `stationCount` (Stellen in the sum with Gesamtpersonen > 0),
   `oldestReportedAt` (min over those, null if none); `REPORT_STALE_AFTER_MS = 60
   min`; `isReportStale(report, now)` false when Gesamtpersonen 0; boundary at exactly
   60 min not stale; `formatTotalStrengthText(total)` → „Gesamtstärke gemeldet:
   2/6/25//33, +6 zusätzlich, 39 Personen (4 Stellen, älteste Meldung 10:10)".
   Tests: no Stellen, Stelle without report, zero report excluded from oldest and
   count, all zero → 0 without oldest, later non-zero report restores normal.
2. `JournalEntryType` gains `gesamtstärke-gemeldet`; `annulEntry` accepts `manuell`
   and `gesamtstärke-gemeldet`, `correctEntry` only `manuell` (journal tests).
3. `src/server/strength/total-strength.ts` (new) + test: `reportTotalStrength(db,
   operationId, author)` - transaction: `lockOperation` first, then
   `listStrengthReports` + `totalOf` + `appendEntry`. Tests: text with values;
   closed operation still accepted; lock order, deterministic: the test opens its own
   `db.transaction`, calls `recordStrengthReport(tx, …)` inside it (that takes the
   operation lock via `appendEntry`), starts `reportTotalStrength(db, …)` without
   awaiting, polls `pg_stat_activity` until a backend waits with
   `wait_event_type = 'Lock'`, then commits and asserts the Gesamtstärke entry
   includes the report and has the higher number. A version that sums before
   locking reads the uncommitted state and fails.
4. `reportTotalStrengthAction(operationId)`; auth test.
5. `StrengthPanel`: sum card on top (hidden with no Stellen) with values, „älteste
   Meldung HH:mm" (highlighted when stale), „Gesamtstärke melden" disabled without a
   valid report; Stelle card time highlighted when stale; `useStalenessClock` for
   `now` (injectable for tests). Tests for each.
6. `JournalPanel`: `gesamtstärke-gemeldet` has no badge, is not filtered, its „⋯"
   has only „Annullieren …" (test; the modal flow already exists).
7. Glossary: **Annullieren** also for „Gesamtstärke gemeldet".
8. `npm run check`.

AC-13 now (amended by the user) also says: „Zählt keine Stelle, entfällt „, älteste
Meldung …" („(0 Stellen)"); bei genau einer heißt es „1 Stelle"." - tests for both.

## Not here
Summenverlauf (05); correction/annul of reports (06, 07). Non-goals: no
recipient recorded, nothing transmitted to the EL.
