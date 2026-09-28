---
solution:  02-SOLUTION.md
satisfies: AC-7, AC-8, AC-13, AC-19
after:     02-meldung-erfassen
status:    done
attempts:  1
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

## Record

**Criteria → tests**

- **AC-7** (sum of F/UF/H/Σ/zusätzlich/Gesamtpersonen over each Stelle's latest valid report; Stellen without one don't count)
  - `src/strength/strength.test.ts` › totalOf: „is 0 without Stellen, with no oldest report", „adds up the latest valid report of each Stelle and names the oldest of them" (an older and an annulled newer report of the same Stelle are ignored), „leaves out a Stelle without a valid report".
  - UI: `src/strength/StrengthPanel.test.tsx` › the sum: „adds up the latest valid reports and names the oldest of them" (Stelle without report included), „is not shown without Stellen" (**Keine Stellen**), „is not shown while a Stelle's form is open".
- **AC-8** (oldest time next to the sum; stale highlight on the sum and on each card after 60 minutes)
  - `strength.test.ts` › isReportStale / isTotalStale: „is not stale at exactly 60 minutes, but a millisecond later", „never calls a total without an oldest report stale", „calls a report with only zusätzliches Personal stale".
  - `StrengthPanel.test.tsx`: the sum › „highlights the oldest report once it is older than 60 minutes"; the card of a Stelle › „highlights its time once the report is older than 60 minutes". The highlight is red bold text with a `data-stale` attribute.
  - `src/map/SituationWorkspace.test.tsx` „reports the Gesamtstärke and marks a report older than 60 minutes" (pins that the workspace's ticking `useStalenessClock` reaches the panel).
- **AC-13** (ETB text, „1 Stelle" / „(0 Stellen)", sum computed under the operation lock, button disabled without a valid report, annullable in the ETB)
  - `strength.test.ts` › formatTotalStrengthText: „formats the sum with the Stellen and the oldest report in Berlin time" (the AC example), „says „1 Stelle" for exactly one" (winter time), „leaves out the oldest report when no Stelle counts".
  - `src/server/strength/total-strength.test.ts`: „records the sum over the Stellen in the ETB with its author", „reports 0 Stellen when every Stelle reports 0", „rejects a sum without any valid report, writing nothing", „still reports once the Gesamteinsatz is closed", „can be annulled", „includes a report numbered before it that it had to wait for". The last one is the planned lock-order test: it waits for a `pg_stat_activity` lock wait, and it was red (assertion) against a version that summed before locking.
  - Action: `src/app/operations/[id]/strength-actions.test.ts` „reports the Gesamtstärke in the name of the logged-in user", „reports a Gesamtstärke without any report as a form error"; `reportTotalStrengthAction` is in `src/app/auth-enforcement.test.ts`.
  - UI: `StrengthPanel.test.tsx` › the sum: „cannot be reported without a valid report", „reports the Gesamtstärke", „shows a returned error", „shows a failed report as an error".
  - ETB: `src/server/journal/journal-history.test.ts` › a gesamtstärke-gemeldet entry: „can be annulled", „cannot be annulled twice", „cannot be corrected". `src/app/operations/[id]/JournalPanel.test.tsx` „offers only „Annullieren …" for a gesamtstärke-gemeldet entry, which is neither automatic nor hidden" (goes through the confirmation modal), „offers no actions for an annulled gesamtstärke-gemeldet entry".
- **AC-19** (0 Gesamtpersonen: never stale, not in the oldest time, not in the Stellen count; normal again after a later non-zero report)
  - `strength.test.ts`: „never calls a report of 0 Personen stale" (proven by removing the guard: red), totalOf › „counts a Stelle reporting 0 Personen neither as Stelle nor for the oldest report", „counts a Stelle normally again once it reports Personen after 0".
  - `StrengthPanel.test.tsx` „never highlights the time of a report of 0 Personen".
- **Alle Stellen auf 0**: `strength.test.ts` „is 0 without an oldest report when every Stelle reports 0"; `StrengthPanel.test.tsx` „shows 0 without an oldest report when every Stelle reports 0" (button stays enabled); `total-strength.test.ts` „reports 0 Stellen when every Stelle reports 0".
- **Stelle ohne Meldung**: see AC-7 „leaves out a Stelle without a valid report".

**Command**: `docker compose -f docker-compose.test.yml up -d && npm run check`. The first full run was green (112 files, 959 tests). Three later full runs, all at load average 11–14 on 4 cores, each timed out a different 2–8 tests after 5 s. All of them were in `src/map/SituationWorkspace.test.tsx` map tests (panels, circles, image overlays), which this change doesn't touch. The file passes alone (131/131). Timed back to back, it took 152–154 s on a HEAD worktree and 112–121 s with this change, so the change doesn't slow it. The last run, `tsc --noEmit && npm run lint && vitest run --maxWorkers=2`, was green: 112 files, 959 tests.

**Departures from the plan**

- **The server rejects a Gesamtstärke without any valid report** with „Es gibt noch keine gültige Stärkemeldung." and writes nothing. The plan only disabled the button. Without the check, a stale page or a report annulled in the meantime (ticket 07) would write a „0 Stellen" entry that no report backs.
- **`reportTotalStrength(db, {operationId, author})`** opens its own transaction and takes `lockOperation` itself before `listStrengthReports`. `appendEntry` takes the same lock again, which is harmless.
- **Annul rule split in `journal.ts`**: `annulEntry` accepts `manuell` and `gesamtstärke-gemeldet` and otherwise refuses with the new message „Dieser Eintrag kann nicht annulliert werden.". Before, it said „Nur manuelle Einträge können geändert werden.", which would now be wrong. `correctEntry` keeps the old message. The already-annulled check now runs before the type check, which only changes the message for an annulled non-manual entry.
- **`now` is a prop of `StrengthPanel`**, fed by the `useStalenessClock` that `SituationWorkspace` already runs (30 s tick). The panel doesn't start a second clock.
- **`berlinTimeOfDay` moved from `StrengthPanel.tsx` to `strength.ts`**, so the server's ETB text and the view format times the same way. `StrengthCounts` (the four numbers without the note) was split out of `StrengthValues`, so `sumOf`/`totalPersonsOf` also take a `Total`.
- **`totalOf` takes the reports grouped per Stelle** (`ReportedStrength[][]`). The server groups `listStrengthReports` by `stationId`; the client passes `stations.map(s => s.reports)`. Whether any Stelle has a valid report (for the button) is checked next to it, not stored in `Total`.
- **The sum card is hidden while a Stelle's form is open.** The pane shows either the list with the sum, or one form.
- Some tests passed on their first run because a stub already returned the right value: „never calls a report of 0 Personen stale" and „never calls a total without an oldest report stale" against a stub returning `false`. The first was proven by removing the guard afterwards (red); the second is a null check that TypeScript enforces.

**Left standing**

- Review nit, not fixed: the rule for which entry types can be annulled exists twice, as `ANNULLABLE_TYPES` in `journal.ts` and `canAnnul` in `JournalPanel.tsx`. The client can't import `journal.ts` (`node:crypto`), and the `JournalEntryType` union is already duplicated the same way by design.
- Review note: after a successful „Gesamtstärke melden" the Stärke view doesn't change, apart from the button's loading state. On a phone without the ETB visible, a user might tap twice and write two entries; the second can be annulled. No AC asks for feedback. This fits ticket 10's mobile check.
- Not checked in a real browser: whether the „Summe · älteste Meldung HH:mm" header fits on one line at 360 px, and the contrast of the red highlight (ticket 10). `page.tsx` wiring is covered only by `tsc`.
- The load-dependent timeouts in `SituationWorkspace.test.tsx` described under Command are pre-existing, as in tickets 01 and 02.

