---
solution:  02-SOLUTION.md
satisfies: AC-1, AC-2
after:     
status:    ready
attempts:  0
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
