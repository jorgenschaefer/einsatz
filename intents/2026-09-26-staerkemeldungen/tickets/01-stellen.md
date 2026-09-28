---
solution:  02-SOLUTION.md
satisfies: AC-1, AC-2
after:     
status:    done
attempts:  1
---

## Build
The third main view „Stärke" exists and lists the Gesamteinsatz's Stellen; a Stelle can be created and renamed, each writing its ETB entry.

## Done when
> **AC-1** In der Ansicht „Stärke" legt die Führungskraft eine Stelle mit einem Namen an. Der Name wird getrimmt und darf nicht leer sein. Innerhalb eines Gesamteinsatzes ist er eindeutig, ohne Rücksicht auf Groß- und Kleinschreibung („UHSt 3" und „uhst 3" gelten als dieselbe Stelle). Es entsteht der ETB-Eintrag „Stelle angelegt: UHSt 3".

> **AC-2** Die Führungskraft kann eine Stelle umbenennen, mit denselben Regeln für den Namen; eine Umbenennung, die nur die Groß- und Kleinschreibung ändert, ist erlaubt. Ihre Meldungen bleiben an ihr. Es entsteht der ETB-Eintrag „Stelle umbenannt: UHSt 3 → UHSt 3 Nord".

> **Abgeschlossener Gesamteinsatz:** Es gilt dasselbe wie für Handeinträge im ETB heute: Die Aktionen prüfen den Status nicht.

> **„Automatische ausblenden" im ETB** blendet die Stärke-Einträge nicht aus (siehe Approach).

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
1. Migration `src/server/db/migrations/011_stations.sql` (new): `stations (id uuid pk,
   operation_id uuid not null references operations on delete cascade, name text not
   null check (length(btrim(name)) > 0), created_at timestamptz not null default
   now())`, `CREATE UNIQUE INDEX stations_operation_name_idx ON stations (operation_id,
   lower(name))`. Proof: `src/server/db/migrations.test.ts` still green; Station tests below.
2. `JournalEntryType` gains `stelle-angelegt`, `stelle-umbenannt`
   (`src/server/journal/journal.ts` and the copy in `JournalPanel.tsx`).
3. `src/server/strength/stations.ts` (new) + test: `createStation(db, {operationId, name,
   author})` - trims, rejects empty (`ValidationError`), in one transaction inserts
   the row and `appendEntry(tx, {type: "stelle-angelegt", text: "Stelle angelegt:
   UHSt 3"})`; unique-violation (23505) → `ValidationError("Eine Stelle mit diesem
   Namen gibt es schon.")`. `renameStation(db, {stationId, name, author})` - same name rules,
   case-only rename allowed (the index compares lower(name) of *other* rows only
   because it is the same row being updated), text „Stelle umbenannt: UHSt 3 → UHSt 3
   Nord", returns operationId. `listStations(db, operationId)` ordered by created_at.
   Tests (freshDb): trim; empty/whitespace rejected; „UHSt 3" vs „uhst 3" rejected in
   same operation, allowed in another; rename writes entry; rename to case variant of
   own name allowed; rename onto another Stelle's name rejected; ETB entry text,
   type, author; closed operation still accepts both.
4. `strength-actions.ts` (new): `createStationAction(operationId, name)`,
   `renameStationAction(stationId, name)` via `operationAction`; add both to
   `auth-enforcement.test.ts`.
5. `MainViewBar.tsx`: `MainView = "map" | "etb" | "strength"`, third item „Stärke"
   (`IconUsersGroup`). Test in `MainViewBar.test.tsx`.
6. `SituationWorkspace.tsx`: the ETB badge counts new entries whenever the ETB is
   not the active view (map *or* Stärke) - confirmed by the user; test. Third pane `data-view="strength"`, inline `display:
   none` unless `mainView === "strength"` (also hides it in the pre-hydration
   "default" state); map pane hidden unless map/default, ETB pane hidden for map and
   strength. New props `stations`, `onCreateStation`, `onRenameStation`; `page.tsx` loads
   `listStations` and binds the actions. Test in `SituationWorkspace.test.tsx`:
   selecting „Stärke" shows the pane and hides map and ETB; switching away and back
   keeps typed text in the create field (pane stays mounted).
7. `src/strength/StrengthPanel.tsx` (new) + test: card per Stelle with its name;
   „+ Stelle" opens an inline name field; rename from the Stelle (inline field with
   Speichern/Abbrechen); `{error}` shown as Alert like `JournalPanel`. Tests drive
   the UI with fake actions: create calls `onCreateStation` with the typed name and
   shows a returned error; rename likewise.
8. `JournalPanel.tsx`: „automatisch" = only `einsatz-eröffnet`/`einsatz-geschlossen`
   (no badge for Stelle entries, „Automatische ausblenden" keeps them); the „⋯" menu
   only for `manuell`. Tests in `JournalPanel.test.tsx`: a `stelle-angelegt` entry
   has no badge, survives the filter, has no „⋯".
9. `UBIQUITOUS_LANGUAGE.md`: add **Stelle** (`Station`), **Gesamteinsatz**.
10. `npm run check`.

## Not here
reports and the card's report line / „noch keine Meldung" (02); sum,
„Keine Stellen" edge case (03); mobile-width verification (10); live-update
verification (09). Non-goals: no deleting/stilllegen/ausblenden of a Stelle, no
location or map symbol, no Stelle as sender/recipient of ETB entries, nothing in the
view/device-link views.

## Record

**Criteria → tests**

- **AC-1** (create, trim, non-empty, case-insensitive unique per Gesamteinsatz, ETB „Stelle angelegt: …")
  - `src/server/strength/stations.test.ts` › createStation: „creates a Stelle with its name and lists it", „records „Stelle angelegt: …" in the ETB with its author", „trims the name", „rejects the empty name "" / "   " without writing anything", „rejects a name that differs from an existing Stelle only in case", „allows the same name in another Gesamteinsatz", „lists the Stellen of a Gesamteinsatz oldest first", „creates concurrent Stellen of one Gesamteinsatz without deadlocking".
  - `src/app/operations/[id]/strength-actions.test.ts`: „creates a Stelle in the name of the logged-in user", „reports a duplicate name as a form error".
  - UI: `src/strength/StrengthPanel.test.tsx` › creating a Stelle (5 tests); `src/map/MainViewBar.test.tsx` „offers „Stärke" as the third view, after Lagekarte and ETB"; `src/map/SituationWorkspace.test.tsx` › the main view Stärke (5 tests, incl. „keeps a started Stelle name when switching to the ETB and back").
- **AC-2** (rename, same name rules, case-only allowed, ETB „Stelle umbenannt: alt → neu")
  - `stations.test.ts` › renameStation: „renames the Stelle and records „Stelle umbenannt: alt → neu"" (also asserts the id is kept, so reports will stay attached; the reports themselves are ticket 02), „allows a rename that only changes the case", „writes nothing when the name stays the same", „rejects a rename onto another Stelle's name without writing anything", „rejects the empty name", „rejects an unknown Stelle".
  - `strength-actions.test.ts`: „renames a Stelle in the name of the logged-in user", „reports an empty new name as a form error".
  - UI: `StrengthPanel.test.tsx` › renaming a Stelle (3 tests); `SituationWorkspace.test.tsx` „renames a Stelle".
- **Abgeschlossener Gesamteinsatz**: `stations.test.ts` „still accepts a Stelle once the Gesamteinsatz is closed", „still renames once the Gesamteinsatz is closed".
- **„Automatische ausblenden" / not automatic / untouchable**: `JournalPanel.test.tsx` „shows a stelle-angelegt / stelle-umbenannt entry as neither automatic nor changeable, and keeps it when automatic ones are hidden"; `src/server/journal/journal-history.test.ts` › „a stelle-angelegt / stelle-umbenannt entry" › „cannot be corrected", „cannot be annulled".
- Auth: both actions are in `src/app/auth-enforcement.test.ts`. Cascade: `delete-operation.test.ts` „cascades the operation's Stellen".
- ETB badge while on Stärke: `SituationWorkspace.test.tsx` „counts a new entry from another author while Stärke is shown", „keeps the count when switching from Lagekarte to Stärke / Stärke to Lagekarte".

**Command**: `docker compose -f docker-compose.test.yml up -d && npm run check` → green, 109 files, 861 tests.

**Departures from the plan**

- `createStation` appends the ETB entry *before* inserting the Stelle. The planned order (insert, then entry) deadlocked reliably under concurrent creates: the FK takes FOR KEY SHARE on the operation, and `appendEntry` then wants FOR UPDATE. This is pinned by the concurrency test above.
- A rename to the identical (trimmed) name is a no-op and writes no ETB entry. Otherwise it would leave a permanent, unannullable „UHSt 3 → UHSt 3" entry. This came from review.
- `switchMainView` now marks ETB entries as seen only when entering or leaving the ETB. The plan kept the old "every switch" behaviour, which would have cleared the badge on Lagekarte ↔ Stärke. This came from review.
- The server's refusal to correct or annul non-manual entries now reads „Nur manuelle Einträge können geändert werden." instead of „Automatische Einträge sind unantastbar.", because Stelle entries are deliberately not automatic. The glossary's Annullieren/Korrigieren/Typ lines are adjusted to match.
- No `src/strength/strength.ts` yet: this ticket has no pure shared logic. `StationView` lives in `StrengthPanel.tsx`. Ticket 02 creates the module when it needs it.
- The Stärke pane has its own class `strength-pane`, sharing the ETB width rules. Rename is started from a pencil icon on the card; the mockup shows no rename affordance.
- Not strictly test-first in a few places: `renameStation`'s body was written with its first test. That made the later rename tests, plus „oldest first", „another Gesamteinsatz" and the two closed-operation tests, pass on first run. Each rename rule was instead proven by mutating the code (dropping the duplicate translation, the not-found check, trimming, the UPDATE) and watching its test go red.

**Left standing**

- Review nit, not fixed: `renameStation` locks the Stelle row before the operation row, while `deleteOperation` locks the operation first and then cascades. A rename racing a delete could in theory deadlock (40P01 → „Speichern fehlgeschlagen", retry works). I tried to reproduce it with 300 concurrent rename/delete pairs and couldn't, so no red test exists and the code is unchanged. The lock-order comment was narrowed to what it actually guarantees (concurrent creates).
- Review note, not checked: the error alert sits at the top of the Stärke pane. With a long list on a 360 px phone, a rename error far down may be off-screen. This belongs to ticket 10's mobile check.
- No test pins a non-ASCII duplicate (e.g. „Übergabe" vs „übergabe"). The reviewer confirmed `lower()` folds umlauts under the test and prod locale.
- `page.tsx` wiring is covered only by `tsc`. The UI was not looked at in a real browser; 360 px and live-update checks are tickets 10 and 09.
- During one run, `SituationWorkspace.test.tsx` „closes it when an Erweitert composition is armed" / „places a composition built in the Erweitert form …" hit the 5 s timeout at load average ~8. They pass in isolation with the same durations as on `HEAD` (~1.5–3 s), so this is a pre-existing sensitivity to load, not caused by this change.
