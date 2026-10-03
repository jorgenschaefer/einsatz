---
criteria:  CRITERIA.md
closes:    AC-1, AC-2, AC-3, AC-4, AC-13
advances:  AC-5, AC-12
after:
status:    ready
attempts:  0
---

## Build
A row Kartenzeichen | Bereiche | Ebenen directly above the main view bar
whenever Lagekarte is active, in the desktop sidebar and above the phone's
bottom bar. It replaces the three panel buttons in the map's bottom-right
corner.

## Done when
> **AC-1** Desktop: while Lagekarte is the active view, a row Kartenzeichen | Bereiche | Ebenen sits directly above the sidebar's bar; clicking an entry shows that panel in the sidebar and marks the entry as selected.

> **AC-2** Desktop: under Lagekarte exactly one panel is always shown and marked in the row; on first opening Lagekarte it is Kartenzeichen.

> **AC-3** Phone: while Lagekarte is the active view, the same row sits directly above the bottom bar; tapping an entry opens that panel as a sheet over the map and marks the entry; tapping the marked entry again, or the sheet's close button, closes the sheet; with the sheet closed no entry is marked. While the on-screen keyboard is open, the row is hidden together with the bottom bar.

> **AC-4** The row is not shown under ETB or Stärke, on desktop or phone.

> **AC-13** Phone: a sheet open when switching to ETB or Stärke is open again, with its entry marked, on returning to Lagekarte.

Toward AC-5: the map corner holds no panel buttons any more ("Standard-Ausschnitt
festlegen" and "Zum Standard-Ausschnitt zurück" are still there).

Toward AC-12: the Ansichtslink and Gerätelink views show no panel row; their
existing tests pass unchanged.

## Toward
> **AC-5** The map corner holds only the zoom buttons and "Zum Standard-Ausschnitt zurück"; there are no panel buttons and no "Standard-Ausschnitt festlegen" anywhere on the map.

> **AC-12** The read-only map views (Ansichtslink and Gerätelink) look and behave as before this change.

## Nudges
> Build the panel row as one component used in both places (desktop sidebar, above the phone bar), and keep the panel logic in `useMainView` (`selectMapPanel`: on desktop a panel is always open, on the phone the entry toggles).

> Move `MapPanel` and `MAP_PANEL_LABEL` out of `MapControls.tsx` to the new row; `MapControls` keeps only "Zum Standard-Ausschnitt zurück".

> Leave `DeviceView` and `ReadOnlySituationMap` untouched.

## Context
- Today the three panel buttons sit at the top of `MapControls`
  (`src/map/MapControls.tsx`), a column at the map's bottom-right corner that
  also holds "Standard-Ausschnitt festlegen" and "Zum Standard-Ausschnitt
  zurück". `MapControls` is rendered in `src/map/SituationMapView.tsx` (around
  line 289) inside `.map-area`; its CSS is `.map-controls` /
  `.map-controls__view` in `src/map/situation-workspace.css`.
- Which panel is shown is decided in `src/map/useMainView.ts`: `shownPanel` is
  `openPanel ?? "symbols"` on desktop under Lagekarte, and `openPanel` (may be
  null) on the phone. `selectMapPanel` toggles on the phone and always opens on
  desktop. `openPanel` survives switching to ETB/Stärke - that is what AC-13
  asks for and `SituationWorkspace.panels.test.tsx` ("keeps the open map panel
  when switching to the ETB and back") already pins it. Keep this logic.
- `MainViewBar` (`src/map/MainViewBar.tsx`, `main-view-bar.css`) is the bar:
  on desktop it is rendered in `.sidebar-bar` (grid column 2, row 2 of
  `.situation-workspace`), on the phone it is the AppShell footer
  (`LageansichtShell`, `FOOTER_HEIGHT` 56), which is removed while
  `useKeyboardOpen()` is true.
- Desktop layout: `.situation-workspace` is a grid `minmax(0,1fr) 360px` by
  `minmax(0,1fr) 56px`; `.map-view` is `display: contents`, so `.map-area`
  (col 1, all rows) and `.map-panel` (col 2, row 1) are grid cells. The new row
  goes between `.map-panel` and `.sidebar-bar`: add an `auto` grid row and
  place the row in it; ETB/Stärke render no row, so the auto row is empty there.
- Phone layout: `.map-view` is a flex container with `.map-area` and the sheet
  `.map-panel` positioned `absolute; inset: 50% 0 0 0`. The row must sit below
  the map, directly above the footer, and the sheet must end at the row's top
  edge, not cover it.
- Specimen (agreed, build to it): `specimens/kartenpanels.html` beside
  `CRITERIA.md`, published at https://claude.ai/artifact/9Ssmr7joXVdhRPNz64ZmqE.
  It shows the row as a segmented strip directly above the bar; the selected
  entry is highlighted.
- Tests find the panel buttons by `getByLabelText(name, { selector: "button" })`
  and their state by `aria-pressed` (helper `openPanel` in
  `src/map/SituationWorkspace.fixtures.tsx`, `mapButton` in the panels test,
  and about a dozen test files). `getByLabelText` matches only `aria-label`,
  not button text. The entries show text only, as in the specimen (no icons),
  and each carries `aria-label` "Kartenzeichen", "Bereiche", "Ebenen" and
  `aria-pressed`, so the existing workspace tests that open a panel under Lagekarte
  keep working.
- Some existing tests click a panel button while ETB or Stärke is shown,
  which AC-4 makes impossible: in `SituationWorkspace.panels.test.tsx`
  "shows no map panel beside the ETB", "switches the sidebar from the ETB to
  Lagekarte with the panel of a map button", "shows the last chosen panel
  again after the ETB", "keeps a half-filled Stärkemeldung across the
  Lagekarte", "opens the sheet of the map button pressed on the desktop on a
  phone"; in `SituationWorkspace.modes.test.tsx` "keeps an armed symbol
  across the Stärke and back via a map button". Rewrite each to select
  Lagekarte first and then the row entry, keeping what it protects (panel,
  form and mode state survive the switch); where one asserts
  `aria-pressed="false"` on a panel button while ETB is shown ("shows no map
  panel beside the ETB", "shows the last chosen panel again after the ETB"),
  drop that assertion - the switch's absence under ETB is AC-4's test in
  step 1; delete "switches the sidebar from
  the ETB to Lagekarte with the panel of a map button", whose only subject is
  the jump from ETB that no longer exists. Any other test that fails for the
  same reason gets the same treatment.
- With the row only under Lagekarte, the desktop branch of `selectMapPanel`
  no longer needs `switchMainView("map")`; remove that call. The rest of
  `useMainView` stays.

## Plan
1. **Red: the row where the user acts.** In the existing
   `src/map/SituationWorkspace.panels.test.tsx` (400 lines; do not add another
   `SituationWorkspace.*.test.tsx` file - the existing ones already break the
   one-test-file-per-source rule, see
   `changes/backlog/tests-der-lageansicht-zuordnen.md`), add tests for AC-1
   to AC-4, replacing existing tests they make redundant (e.g. "switches and
   closes map panels via the controls and ✕ on a phone" becomes the AC-3
   test) and using `it.each` for the desktop/phone pairs, so the file stays
   under 500 lines:
   the row is a group (e.g. `role="group"`, label "Kartenpanels") containing
   exactly the three entries in order; desktop: under Lagekarte Kartenzeichen
   is pressed at first, clicking Ebenen shows the Ebenen panel and moves the
   press, under ETB and Stärke the group is absent; phone: under Lagekarte no
   entry pressed at first, tapping one opens its sheet and presses it, tapping
   it again or ✕ closes the sheet and unpresses it; the group is absent under
   ETB/Stärke and while the keyboard is open (stub `visualViewport` with the
   helper in `src/test/visual-viewport.ts`). Extend the
   existing "keeps the open map panel when switching to the ETB and back" test
   to cover both ETB and Stärke (e.g. `it.each`) and assert the entry is
   pressed again (AC-13). Also assert the panel buttons
   are no longer inside the "Kartenknöpfe" group. Rewrite or delete the
   existing tests listed under Context as stated there. Run `npx vitest run
   src/map/SituationWorkspace.panels.test.tsx src/map/SituationWorkspace.modes.test.tsx`
   - the new tests red. `wc -l` on the panels test stays under 500; if it
   would not, shorten its existing setup first (shared helpers, `it.each`).
2. **The row component.** New `src/map/MapPanelSwitch.tsx` (+ new
   `src/map/MapPanelSwitch.test.tsx` for its own rendering: order, pressed state,
   reported click). Move `MapPanel` and `MAP_PANEL_LABEL` here from
   `MapControls.tsx` (the entries are text-only; `PANELS` goes in step 3); update the imports in `MapPanelSheet.tsx`,
   `SituationMapView.tsx`, `useMainView.ts` and anything else `tsc` names;
   drop `switchMainView("map")` from the desktop branch of `selectMapPanel`.
   Proven by `MapPanelSwitch.test.tsx`.
3. **Trim `MapControls`.** Remove the panel buttons, `PANELS` with its icon
   imports, and the `openPanel` / `onSelectPanel` props; the column keeps "Standard-Ausschnitt festlegen" and
   "Zum Standard-Ausschnitt zurück" (the former leaves in ticket 02). Update
   `MapControls.test.tsx`: drop the panel-button cases, adjust "lists the map
   controls from top to bottom". Proven by that test file.
4. **Place the row.** Render `MapPanelSwitch` once in `SituationMapView` after
   `.map-area` and the sheet, only while `mapShown` and the main view is
   Lagekarte (on desktop `mapShown` is always true, so pass the main view or a
   `panelSwitchShown` flag from `SituationWorkspace`), and on the phone only
   (`isDesktop === false`) also hidden while `useKeyboardOpen()` is true - on
   desktop width the switch stays even if the hook reports a keyboard. Pressed entry = `shownPanel`. CSS in
   `situation-workspace.css`: desktop grid gets an `auto` row between panel and
   bar (`grid-template-rows: minmax(0,1fr) auto 56px`; `.sidebar-bar` moves to
   row 3, `.map-area` still spans all rows). Phone: `.map-area`, the sheet
   `.map-panel` and the switch stay direct children of `.map-view` (the
   desktop grid relies on that via `display: contents`); `.map-view` becomes
   `flex-direction: column` with `.map-area` `flex: 1` and the switch a fixed
   height at the bottom, and the sheet's bottom inset is that height (a CSS
   variable shared by both rules), so it ends at the switch's top edge -
   only while the switch is rendered: mark `.map-view` with a data attribute
   (e.g. `data-panel-switch`) when it is, and the inset is 0 otherwise, so
   with the keyboard open the sheet reaches the bottom and no strip of map
   shows below it.
   Delete the phone rule `[data-panel-open] .map-controls { bottom: … }` - it
   lifted the panel buttons above the sheet, and everything left in the column
   is hidden while a sheet is open; the `[data-panel-open] .map-controls__view
   { display: none }` rule stays unchanged (AC-6). Proven by step 1's tests going green.
5. **Look at it.** Start the app (`run-einsatz` skill), open an Einsatz on
   desktop width and at 360 px: compare with the specimen, check the row is not
   cut off at 360 px, the sheet does not cover it, and the corner shows no
   panel buttons. With the Ebenen sheet open, focus the KML URL field with the
   on-screen keyboard open (or a reduced viewport height): the switch is
   gone and the sheet reaches the bottom without a gap. Note anything not checkable by test under `## Left standing`.
6. **Read-only views untouched (toward AC-12).** Confirm `git diff` touches
   nothing under `ViewLinkView.tsx`, `DeviceView.tsx`,
   `ReadOnlySituationMap.tsx`; `npm run check` green.

Decided here: the new component is named `MapPanelSwitch` (CSS class
`map-panel-switch`; not `PanelRow`/`panel-row`, which already name a list row
inside a panel) and owns the `MapPanel` type; its group label is
"Kartenpanels"; its entries are text-only buttons as in the specimen, each
with an `aria-label` equal to its text.

## Not here
- "Standard-Ausschnitt festlegen" stays in the corner in this ticket; moving it
  to the header menu is ticket 02, which also writes the AC-5 and AC-12 tests.
- The header (Teilen, back link, ⋮ menu) is ticket 02.
- The contents of the Kartenzeichen, Bereiche and Ebenen panels are out of
  scope for the whole change.

## Left standing
