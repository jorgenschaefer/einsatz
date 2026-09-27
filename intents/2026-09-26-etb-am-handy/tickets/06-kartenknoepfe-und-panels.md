---
solution:  02-SOLUTION.md
satisfies: AC-6, AC-7, AC-8, AC-11, AC-15, AC-20, AC-21, AC-23, AC-24, AC-25
after:     01-hauptansichten-mit-leiste, 02-kopfzeile-am-handy, 03-leiste-weicht-der-tastatur, 04-modus-band, 05-etb-zaehler
status:    done
attempts:  1
---

## Build
The transitional sidebar gives way to map controls in a column bottom right;
their panels open as a half-height sheet on the phone and a 360 px right panel
on the desktop. Leaflet's zoom moves bottom right on all maps, the ⋯ map menu
goes, the search takes the full width. Then the global checks.

## Done when
> **AC-6** Auf der Lagekarte steht rechts unten eine Spalte von Kartenknöpfen, von oben nach unten: Kartenzeichen, Bereiche, Ebenen, Standard-Ausschnitt festlegen, Zurück zum Standard-Ausschnitt; darunter Leaflets Zoom + und −, der auf allen Karten (auch Geräte- und Ansichtslink-Ansicht) unten rechts steht. Jeder Knopf hat ein Symbol und einen zugänglichen Namen. Die Spalte hält Abstand zu Zoom und Attributionszeile. Ist am Handy ein Blatt offen (AC-7), sitzen die drei Panel-Knöpfe direkt über dessen Kante und bleiben antippbar; die übrigen Knöpfe (Festlegen, Zurück) sind ausgeblendet und der Zoom liegt unter dem Blatt, bis es schließt. Bei 360 × 640 hätten alle sieben Knöpfe über dem Blatt keinen Platz. Ein Tipp öffnet das Panel mit dem Inhalt des heutigen Reiters. Ein Tipp auf einen anderen Knopf wechselt das Panel, ein Tipp auf den Knopf des offenen Panels oder auf ✕ schließt es.

> **AC-7** Am Handy öffnet ein Panel als Blatt über der unteren Hälfte der Kartenfläche, mit Titel und ✕. Das Blatt lässt sich nicht ziehen, sein Inhalt scrollt.

> **AC-8** Wird am Handy ein Kartenzeichen zum Platzieren gewählt, das Zeichnen eines Bereichs begonnen oder aus dem Panel ein Kartenzeichen angesprungen, oder beginnt das Bearbeiten eines Bild-Overlays, schließt das Blatt.

> **AC-11** Bei 360 px Breite scrollt nichts waagerecht: keine Hauptansicht, keine Kopfzeile, keine Leiste, kein Blatt und kein Modal.

> **AC-15** Jede Funktion, die heute über Kopfzeile oder Seitenleiste erreichbar ist, ist auf beiden Größen weiter erreichbar.

> **AC-20** „Standard-Ausschnitt festlegen" fragt vor dem Speichern nach in einem Modal („Aktuellen Ausschnitt als Standard festlegen?" mit „Festlegen" und „Abbrechen"); erst die Bestätigung speichert. Das Kartenmenü ⋯ gibt es nicht mehr.

> **AC-21** Die Suche oben auf der Karte nimmt am Handy die volle Breite ein, abzüglich 12 px Rand je Seite, und überdeckt keinen Kartenknopf.

> **AC-23** Am Desktop gibt es die Kartenknöpfe wie in AC-6; das Panel öffnet rechts neben der Karte, 360 px breit, und verkleinert die Karte.

> **AC-24** Beim Wechsel zwischen Hauptansichten bleibt ein offenes Kartenpanel erhalten.

> **AC-25** Beim Öffnen der Führungsansicht ist kein Kartenpanel offen.

Edge cases owned (from the solution):

> **Ein Kartenzeichen wird aus dem Panel „Kartenzeichen" angesprungen** (`jumpTo`): Am Handy schließt das Blatt (AC-8), damit das Ziel nicht darunter liegt. Die Karten-Schnittstelle muss dafür nichts Neues können.

> **Kartenzeichen-Detail, Bereich-Editor und „Erweitert …"** sind heute Modale. Sie bleiben Modale, auf beiden Größen.

The second part of the edge case „Fenster wird über 768 px hinweg verbreitert
oder verschmälert" – „Ein offenes Panel bleibt; nur Ort der Leiste und Form des
Panels wechseln." – is owned here.

## Context
After 01 the Lagekarte view still has the right-hand sidebar with the tabs
Kartenzeichen, Bereiche, Ebenen and the collapse button (both go now). Panel
contents stay as they are (quick select, „Erweitert …", symbol list with jump
and edit; area shape buttons and list; `KmlPanel`, `ImageOverlayPanel` with
`ImageOverlayEditor`).

`SituationMap` (`src/map/SituationMap.tsx`) renders a ⋯ menu („Karten-Optionen")
at the top right with the only item „Standard-Ausschnitt festlegen", calling
`onSetDefault(adapter.getView())`; only the Führungsansicht passes
`onSetDefault`. The workspace renders „Zum Standard-Ausschnitt zurück"
(`IconHome`) at bottom 16 / right 16, and the search (`SearchBar`) at top 12 /
left 12, 340 px wide. Leaflet's zoom is set to `bottomleft` in
`leaflet-adapter.ts` for every map; the attribution (with Impressum and
Datenschutz) sits bottom right.

Decided here: the set-default button moves out of `SituationMap` into the
workspace's control column; `SituationMap` exposes the current view through a
ref (`{ getView(): MapView | null }`) instead of owning the menu. One panel
container is rendered and styled by media query (sheet below `sm`, right panel
from `sm`), so the panel content is mounted once.

Consequence the solution did not spell out: `DeviceView` and `ViewLinkView`
keep their own buttons at bottom right (`bottom={16}`, `76`, `136`); with the
zoom moving there they must sit above it. That offset change is the only
touch to those views besides the zoom.

## Plan
1. **Zoom bottom right.** `leaflet-adapter.ts`:
   `map.zoomControl.setPosition("bottomright")`. Proof: new test in a
   `leaflet-adapter.*.test.ts` (like the attribution test): the zoom control
   is inside `.leaflet-bottom.leaflet-right`.
2. **Buttons in DeviceView/ViewLinkView above the zoom.** Raise their bottom
   offsets by the zoom's height. Files: `DeviceView.tsx`, `ViewLinkView.tsx`.
   Proof: existing tests green; browser check (step 11).
3. **SituationMap without the ⋯ menu.** Remove menu and `onSetDefault`;
   expose `getView` via ref. Files: `SituationMap.tsx` (+ test: the
   „Karten-Optionen" tests go, a test pins that the ref returns the adapter's
   view).
4. **Control column.** New `src/map/MapControls.tsx` (+ test), bottom right in
   the map box, top to bottom: Kartenzeichen, Bereiche, Ebenen (toggle
   buttons, `aria-pressed`, icon + accessible name), „Standard-Ausschnitt
   festlegen", „Zum Standard-Ausschnitt zurück"; bottom offset clears zoom
   and attribution. „Festlegen" opens a `Modal` „Aktuellen Ausschnitt als
   Standard festlegen?" with „Festlegen"/„Abbrechen"; only „Festlegen" calls
   `onSetDefault(mapRef.current.getView())`. Proof: tests "saves the default
   view only after confirming", "does not save on Abbrechen".
5. **Panel state.** `openPanel: "symbols" | "areas" | "layers" | null`,
   initially `null`; a control opens its panel, another control switches, the
   open panel's control or ✕ closes it. Remove the sidebar, its tabs and the
   collapse button. Proof: tests "opens no panel at start" (AC-25),
   "switches and closes panels via the controls and ✕" (AC-6), "keeps the
   open panel when switching to the ETB and back" (AC-24); adapt `openTab`
   in `SituationWorkspace.test.tsx` to click the control.
6. **Sheet and right panel.** One panel container with title and ✕,
   `overflow: auto`: below `sm` absolute over the lower half of the map (no
   drag), from `sm` a 360 px column beside the map that shrinks it. While the
   sheet is open below `sm`, the column rises above its edge and „Festlegen"
   and „Zurück" are hidden (CSS on a `data-panel-open` attribute). Files:
   `SituationWorkspace.tsx`, `situation-workspace.css`. Proof: browser check
   (step 11); test that the panel keeps its content when the media query
   changes (edge case).
7. **Closing the sheet (phone only).** Arming quick select or „Erweitert",
   starting a draw or redraw, jumping to a symbol from the list, starting an
   image edit close the panel when `matchMedia("(min-width: 48em)")` does not
   match. Proof: tests per trigger with the phone stub (panel closed) and one
   with the desktop stub (panel stays).
8. **Search full width on the phone.** `SearchBar` wrapper: `width: 340`
   from `sm`, `calc(100% - 24px)` below. Proof: browser check.
9. **Modals stay modals.** Proof: existing tests for symbol detail, area
   editor and „Erweitert …" green.
10. **Adapt tests** that relied on the sidebar, the collapse button or the
    home button position. Proof: `npm test` green.
11. **Browser check** at 360 × 640 and 1280 × 800, long operation name:
    column bottom right clear of zoom and attribution; sheet over the lower
    half with the three panel buttons above its edge; right panel 360 px on
    the desktop; search full width on the phone and not covering a control;
    DeviceView and ViewLinkView buttons clear of the zoom. **AC-11:** no
    horizontal scroll in ETB, Lagekarte, header, bar, sheet and every modal
    (symbol detail, Erweitert, area editor, Ansichtslinks, set-default
    confirmation). **AC-15:** walk every former header/sidebar function on
    both sizes – Zurück, name, Teilen, status; ETB add/correct/annul;
    Kartenzeichen quick select, Erweitert, list, jump, edit; Bereiche draw,
    list, edit; Ebenen KML file/URL, visibility, reload, remove; image add,
    edit, replace, delete; set and return to the default view; zoom; search;
    Impressum and Datenschutz. Record each in `## Record`.
12. `npm run check`.

## Not here
Mode band and mode cancel on switch (04). Header, connection symbol, map
error overlay (02). Bar and main views (01).

Non-goals from the solution: dragging the sheet or snapping it to stops;
changing DeviceView/ViewLinkView beyond the zoom position (and the resulting
button offset); improving the map tools themselves on the phone.

## Record

Command: `docker compose -f docker-compose.test.yml up -d && npm run check`
(`tsc --noEmit`, `biome check`, `vitest run`). Result: green, 103 test files
and 733 tests. One intermediate full run timed out on
`LageansichtShell.test.tsx` "shows an orange connection-lost symbol …" and a
second one on three slow `SituationWorkspace` tests (5 s). Both happened while
the browser check was loading the machine. The files passed on their own, and
the final run was fully green. This is the same flake 04 recorded.

Criterion → test (workspace tests are in `src/map/SituationWorkspace.test.tsx`):

- **AC-6, order, icons, names**: `src/map/MapControls.test.tsx` "lists the map
  controls from top to bottom" (aria-labels in order). Browser check: each
  button is 34×34 and has an icon.
- **AC-6, zoom bottom right on all maps**: `src/map/leaflet-adapter.zoom.test.ts`
  "places the zoom control bottom right on every map". The Geräte- and
  Ansichtslink views use the same adapter.
- **AC-6, open, switch and close; aria-pressed**: MapControls "marks the open
  panel's control as pressed" and "reports the tapped panel control"; workspace
  "switches and closes map panels via the controls and ✕".
- **AC-6, the sheet's position and the column above it**: CSS on
  `[data-panel-open]` (`situation-workspace.css`). Workspace "marks the Lagekarte
  while a map panel is open" pins the attribute. Pixels come from the browser
  check below.
- **AC-7**: CSS (`.map-panel`, `.map-panel__content` `overflow: auto`, no drag
  handle). Browser check below.
- **AC-8**: the workspace block "closing the sheet on a phone" has one test per
  trigger:
  - Schnellauswahl armed
  - Erweitert composition armed
  - drawing a Bereich starts
  - a Bereich is redrawn
  - a Kartenzeichen is jumped to from the list
  - a Bereich is jumped to from the list
  - editing an image overlay starts
  - a map action fails
  
  The guards have their own tests: "keeps it open when a Schnellauswahl symbol is
  disarmed", "… when drawing is toggled off" and "keeps the right panel open on
  the desktop". For each trigger and guard, a temporary mutation that removed it
  made its test fail.
- **AC-11**: browser check. The page `scrollWidth` was 360 in all of these
  states: ETB, Lagekarte, all three sheets, open search, name popover, and every
  modal (Kartenzeichen detail, Erweitert, Bereich editor, Ansichtslinks teilen,
  set-default confirmation). Header, bar, sheet and sheet content had
  `scrollWidth` equal to `clientWidth`.
- **AC-15**: browser walk at both sizes. Everything was reachable:
  - Header: Zurück/Einsätze, name, Teilen, status.
  - ETB: add, correct, annul.
  - Kartenzeichen: quick select, Erweitert, list, jump, edit.
  - Bereiche: draw, list, jump, edit.
  - Ebenen: KML file and URL sections. KML upload, visibility and remove worked.
    KML reload was not exercised, because adding a KML by URL is refused for
    localhost.
  - Images: add, edit, replace, delete.
  - Map: set and return to the default view, zoom, search, Impressum and
    Datenschutz links.
- **AC-20**: MapControls "saves the default view only after confirming" and
  "does not save on Abbrechen". Workspace "saves the current map view as the
  default after confirming" checks that the adapter's view reaches
  `onSetDefault`. The ⋯ menu tests in `SituationMap.test.tsx` were removed.
  "exposes the adapter's current view through its ref" pins the ref.
- **AC-21**: CSS (`.map-search`). Browser check: 336 px = 360 − 24, and it
  covers no button.
- **AC-23**: browser check. The panel is 920–1280 (360 px) and the map is 1208 px
  wide without it and 848 px with it.
- **AC-24**: "keeps the open map panel when switching to the ETB and back".
- **AC-25**: "opens no map panel at start". The browser check also found no panel
  after a reload.
- **Edge case, crossing 768 px**: "keeps the open map panel as the right panel
  when the width crosses 768 px". The `matchMedia` stub's `matches` now follows
  `fireChange`. After the crossing, arming keeps the panel (desktop form). The
  test fails if the stub does not update. Browser check: 1280 → 767 became a
  sheet, 768 became a side panel, and the panel stayed open.
- **Edge case, jumping to a Kartenzeichen**: see AC-8.
- **Edge case, modals stay modals**: the existing detail, area-editor and
  Erweitert tests are green, and these modals render outside the panel.

Browser check (plan step 11): run by a subagent with `run-einsatz` on the dev
server at 360×640 and 1280×800, with a long operation name, on a throwaway
Einsatz that was deleted afterwards. Screenshots are in `/tmp/einsatz06/`.
- Phone: the column is at 270–480, the zoom at 493–557 and the attribution at
  567–584.
- Desktop: the column bottom is at 696, the zoom at 709–773 and the attribution
  starts at 783.
- Sheet: 312–584 of a map area of 40–584, so exactly half. The panel buttons end
  8 px above its edge. Festlegen and Zurück are hidden.
- Gerätelink view: the buttons end 13 px above the zoom.
- Ansichtslink view: Zurück ends 13 px above the zoom.

The check found one defect in this change: on the phone the map buttons covered
the open search results. It is fixed by giving `.map-search` a higher z-index
than the column. That is CSS only; jsdom cannot see stacking, so there is no
test, and the check was not re-run after the fix.

Review: two fresh-context `critique` rounds.
- Round 1: no blockers. Three should-fix items, all fixed:
  - Confirming before the map had loaded silently did nothing. It now shows „Die
    Karte lädt noch …". Test: "does not save a default view before the map has
    loaded", using `vi.doMock` on the dynamically imported adapter.
  - A returned `{error}` or a thrown error from `onSetDefault` was swallowed. It
    is now shown in the confirmation. Tests: MapControls "keeps the confirmation
    open and shows the error when saving fails" and "shows a fallback when saving
    throws".
  - The 768 px test could not fail. It was reworked as described above.
  
  Nits fixed: the phone tests now stub `matchMedia` explicitly; sidebar/tab
  wording is gone from comments and test names; the button shadow moved to CSS.
- Round 2: no blockers. One should-fix, fixed: a failed placement or drawing
  showed its error under the phone sheet. A map error now closes the sheet on the
  phone (test above). Two comment nits fixed.

Departures from the plan:
- `MapControls` gets `onSetDefault: () => Promise<ActionResult>`. The workspace
  reads the view through the map ref, so the component does not hold the ref.
- The sheet also closes on a Bereich jump, a redraw and a failed map action.
  AC-8 names only the Kartenzeichen jump and starting a drawing. The reason is
  the same: the target or the error would lie under the sheet. A reviewer raised
  this as a tradeoff for a person.
- Plan step 2 (DeviceView/ViewLinkView offsets) is layout only: +88 px, so 16 →
  104, 76 → 164, 136 → 224. It has no unit test and is pinned by the browser
  check.
- The map error overlay (owned by 02) moved from `bottom 16 / left 56 / right 72`
  to `24 / 12 / 64`, because the zoom left the bottom-left corner.

Left standing:
- **Phone landscape (e.g. 640×360) not checked.** The map area there is about
  264 px tall. The column needs about 314 px from the bottom, so it probably runs
  into the search. The ACs and the plan's check sizes do not cover landscape.
  Fixing it would need a layout decision (a compact column or a different
  offset).
- **Search results under an open sheet.** A long results list runs under the
  phone sheet, for the same stacking reason as the map error. It was not changed.
- **Two „Fertig" buttons during image editing** (from 04): still both there.
  This is a decision for a person.
- **Found by the browser check, not from this ticket:**
  - At exactly 768 px the desktop rail fills the screen (Mantine's AppShell
    breakpoint versus `visibleFrom="sm"`). Owned by 01 (the bar).
  - The desktop header squeezes Teilen and the status between 768 and 900 px with
    a long name. Owned by 02.
  - A duplicate React key when the geocoder returns the same address twice.
- **Focus after closing the sheet with ✕** is not moved back to a control.

