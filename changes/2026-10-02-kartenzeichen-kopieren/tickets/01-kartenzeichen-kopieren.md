---
criteria:  CRITERIA.md
closes:    AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11
advances:
after:     02-situation-workspace-panels-test-aufteilen
status:    done
attempts:  1
---

## Build
A "Kopieren" button on every row of the Kartenzeichen list that arms placement
with that Kartenzeichen's composition without its Bezeichnung, and
"Notunterkunft" as a new last entry of the fixed Schnellauswahl.

## Done when
> **AC-1** Every row in the Kartenzeichen list of the Kartenzeichen panel has a "Kopieren" button right next to the pen (edit) button, styled like the pen (a small, subtle gray icon button). Its accessible name is "‹name shown in the row› kopieren".

> **AC-2** Tapping "Kopieren" starts placement: the "Kartenzeichen platzieren" band with "Abbrechen" appears. On a phone, the panel sheet closes, just as it does when arming a Schnellauswahl entry.

> **AC-3** After "Kopieren", the next tap on the map places a new Kartenzeichen at the tapped point. It has the same DV-102 composition as the copied one (all axes: Grundzeichen, Organisation, Fachaufgabe, Einheit, Verwaltungsstufe, Funktion, Symbol), no Bezeichnung and no Gerätelink, and its position is set manually. The placement mode ends after that one placement.

> **AC-4** Copying a live Kartenzeichen (one with a reporting Gerätelink) also produces a manually positioned Kartenzeichen without a Gerätelink.

> **AC-5** The copied Kartenzeichen stays unchanged: position, Bezeichnung, composition and Gerätelink.

> **AC-6** "Abbrechen" after "Kopieren" places nothing.

> **AC-7** Other users viewing the same Einsatz see the copy appear live, like any other newly placed Kartenzeichen.

> **AC-8** The Schnellauswahl has a new last entry, "Notunterkunft": Grundzeichen ortsfeste Stelle, Fachaufgabe Unterbringung, Organisation Hilfsorganisationen, no Symbol. It is armed and placed like the other entries.

> **AC-9** At 360 px viewport width, a Kartenzeichen row's name is cut off with "…", the pen and "Kopieren" buttons stay fully visible, and nothing scrolls horizontally.

> **AC-10** The rows in the Bereiche list are unchanged: they have no "Kopieren" button.

> **AC-11** Copying or placing a Kartenzeichen adds nothing to the Schnellauswahl: in every Einsatz it shows exactly the fixed entries from the code, and nothing that was placed or copied in any Einsatz.

## Nudges
> Copying arms the existing placement mode for custom compositions (`armCustom`, as `armAdvanced` in `src/map/useSymbolPlacement.ts` does). No new map mode.

> Add the copy button to `PanelRow` (`src/map/PanelRow.tsx`) as an optional action, so the Bereiche list, which also uses `PanelRow`, stays unchanged.

> Delete `changes/backlog/eigene-vorlagen-fuer-taktische-zeichen.md`; this change replaces it.

## Context
Problem: at the KMFE Schleswiger Straße, Notunterkunft and Bus were placed
several times, and each time had to be composed again in "Erweitert …"
(`AdvancedSymbolForm`). A copy on the list row makes another of the same kind
two taps away (Kopieren, then the map), like the Schnellauswahl. Kinds needed
regularly across Einsätze go into the fixed `QUICK_SELECT` in code;
Notunterkunft is the first.

What exists:

- `src/map/SymbolsPanel.tsx` renders the Schnellauswahl (`QuickSelectToolbar`
  fed from `QUICK_SELECT`), "Erweitert …", and one `PanelRow` per
  Kartenzeichen. A row's name is `composition.text` or "Ohne Bezeichnung".
- `src/map/PanelRow.tsx` is a row: a jump button (icon, truncated name, meta)
  and a pen `ActionIcon` (`variant="subtle" color="gray"`, `IconPencil`,
  `aria-label="‹name› bearbeiten"`). `AreasPanel` uses it too.
- `src/map/useSymbolPlacement.ts`: `armQuickSymbol` arms a Schnellauswahl
  entry; `armAdvanced(composition)` calls `mode.armCustom(composition)`,
  closes the Erweitert modal and calls `closeSheetOnPhone()`. While armed,
  `MapModeBands` shows "Kartenzeichen platzieren" / "Abbrechen"
  (`mode.reset`). `placeSymbolAt` resets the mode before calling `onPlace`.
- `src/map/SituationMapView.tsx` (384 lines) wires `SymbolsPanel` to
  `symbolPlacement`.
- The Bezeichnung is `composition.text` (`src/map/composition.ts`); the other
  fields are the DV-102 axes. Gerätelink and position source are columns of
  `map_symbols`, not part of the composition. `createMapSymbol`
  (`src/server/mapsymbols/map-symbols.ts`) inserts only composition and
  position, so a new Kartenzeichen has no Gerätelink and
  `position_source = 'manual'`. `placeMapSymbolAction` goes through
  `operationAction`, which publishes the change on the Einsatz's SSE bus.

## Plan
1. **Red: Kopieren on a row places the composition without Bezeichnung.** In
   `src/map/SituationWorkspace.symbols.test.tsx`, render the workspace with a
   Kartenzeichen whose composition sets every axis plus `text`, and a
   `deviceLinkToken` / `positionSource: "device"` (use `aSymbol` from
   `symbol.fixtures`). Open "Kartenzeichen", click "‹Bezeichnung› kopieren",
   assert the "Kartenzeichen platzieren" band shows, tap the map via
   `captured.options.onMapClick`, and assert `onPlace` was called once with
   the composition minus `text` and the tapped position, and that `onUpdate`,
   `onMove` and `onDelete` were not called (AC-3, AC-4, AC-5). A second map
   tap does not call `onPlace` again. A further test clicks "Abbrechen" after
   "Kopieren", taps the map, and asserts `onPlace` was not called (AC-6).
   Proof: the tests fail for lack of the button.
2. **Red: the sheet closes on a phone.** In
   `src/map/SituationWorkspace.phone-sheet.test.tsx` (split out by ticket 02),
   under "closing the sheet on a phone", add "closes it when a Kartenzeichen is copied" next to the
   Schnellauswahl case (AC-2). Proof: fails.
3. **PanelRow gets an optional copy action.** Add an optional `onCopy` prop to
   `src/map/PanelRow.tsx`. When it is given, render an `ActionIcon` with the
   pen's props, `IconCopy` from `@tabler/icons-react` and
   `aria-label={`${name} kopieren`}`, placed right after the pen. Without
   `onCopy`, the row renders exactly as today. Proof: new
   `src/map/PanelRow.test.tsx` (new): with `onCopy` the "‹name› kopieren"
   button exists and calls it; without it there is none. In
   `src/map/AreasPanel.test.tsx`, assert no row has a "kopieren" button
   (AC-10).
4. **SymbolsPanel passes a copy handler.** Add `onCopy: (composition:
   SymbolComposition) => void` to `SymbolsPanel`, carry `composition:
   s.composition` on each derived row object in the `rows` `useMemo`, and pass
   `onCopy={() => onCopy(row.composition)}` to each `PanelRow`. Proof: a test in
   `src/map/SymbolsPanel.test.tsx` that clicking "‹name› kopieren" calls
   `onCopy` with that row's composition, including for a row shown as "Ohne
   Bezeichnung" (AC-1).
5. **useSymbolPlacement arms the copy.** Add `copySymbol(composition)` to
   `src/map/useSymbolPlacement.ts`: it drops `text` and calls
   `mode.armCustom` with the rest, then `closeSheetOnPhone()`. Wire it in
   `src/map/SituationMapView.tsx` as `onCopy={symbolPlacement.copySymbol}`.
   Proof: steps 1 and 2 turn green.
6. **Notunterkunft in the Schnellauswahl.** Append to `QUICK_SELECT` in
   `src/map/quick-select.ts`: `id: "notunterkunft"`, `label:
   "Notunterkunft"`, composition `{ grundzeichen: "ortsfeste-stelle",
   fachaufgabe: "unterbringung", organisation: "hilfsorganisation" }`. In
   `src/map/quick-select.test.ts`, first make the test red: the list has 11
   entries, the last is Notunterkunft with exactly that composition. Add a
   workspace test in `SituationWorkspace.symbols.test.tsx` that arms
   "Notunterkunft" and places it with that composition (AC-8).
7. **The Schnellauswahl stays fixed.** In
   `SituationWorkspace.symbols.test.tsx`, after copying and placing, and with
   Kartenzeichen of compositions not in `QUICK_SELECT` in the workspace,
   assert the Schnellauswahl buttons are exactly the `QUICK_SELECT` labels in
   order (AC-11). Proof: green once written; it pins that nothing derived
   from placed Kartenzeichen reaches the toolbar.
8. **Live for others (AC-7).** No code: the copy is placed through the same
   `onPlace` → `placeMapSymbolAction` → `operationAction` path as every
   placement, which publishes on the SSE bus. Proof: step 1 pins that the copy
   goes through `onPlace`; confirm in the browser (step 10) with a second
   session.
9. **Delete the replaced backlog item.** Remove
   `changes/backlog/eigene-vorlagen-fuer-taktische-zeichen.md`.
10. **Check in the real app.** `npm run check` green. Then with the
    `run-einsatz` skill: at 360 px width, open Kartenzeichen with a long
    Bezeichnung in the list and confirm the name is cut off with "…", pen and
    Kopieren are fully visible, and the page does not scroll horizontally
    (AC-9). Copy a Kartenzeichen, place it, and watch it appear in a second
    logged-in session (AC-7).

Decided here: the hook function is named `copySymbol` and the prop `onCopy`,
after the domain action "Kopieren".

## Not here
- Copying Bereiche: the `AreasPanel` rows stay without `onCopy`.
- Vorlagen or Schnellauswahl entries maintained by users or admins in the app; nothing stores a list of kinds.
- Prepared, named units that are known before they are deployed (parked in `changes/backlog/vorbereitete-einheiten.md`).
- Reordering the Kartenzeichen list (parked in `changes/backlog/reihenfolge-der-kartenzeichen-liste.md`).
- Showing which Zeichen is armed in the "Kartenzeichen platzieren" band: it stays as it is for every kind of arming.
- A copy action in `SymbolDetailModal`: copying lives on the list row only.

## Left standing
- No automated test proves AC-7 (the copy appears live for others) or AC-9
  (at 360 px the name ends in "…", pen and Kopieren stay visible, nothing
  scrolls sideways). The reviewer checked both in the running app.
  - AC-7: a second logged-in session watched the Einsatz while copies were
    placed from the desktop and from a 360 px phone. Its list and markers
    updated without a reload.
  - AC-9: at 360 px, a row with a long Bezeichnung ended in "…". Pen
    (x 282–310) and Kopieren (x 320–348) were inside the viewport, and
    `scrollWidth` equalled `clientWidth` (360).
- AC-4 and the server side of AC-3 (no Gerätelink, `position_source =
  manual`) are pinned in the client only: the copy goes to `onPlace` with
  the composition alone. A copy cannot carry a Gerätelink because
  `createMapSymbol` takes only composition and position. The reviewer
  confirmed it in the dev database: copying a live Kartenzeichen gave a
  manual row without a token, and the original kept its token, position and
  Bezeichnung.
- Departure from plan step 10: I did not drive the app myself. The
  fresh-context reviewer did step 10 at 360 px and 1920 px, as the build
  process asks.
- Reviewer remark, not a finding, not acted on: on a phone, pen and Kopieren
  are 28 px buttons 10 px apart, so a gloved tap can hit the wrong one. A
  wrong tap is harmless (a dialog to close, or a placement to cancel), and
  AC-1 asks for the pen's styling.
- Copying a Kartenzeichen whose composition has only a Bezeichnung arms an
  empty composition. The server accepts that, as it does from Erweitert.
  It is the spec's "same composition", so I left it.
- `SituationMapView.tsx` (384 lines) gained one line of wiring without being
  split first. Ticket 02 put that split under `## Not here`.
