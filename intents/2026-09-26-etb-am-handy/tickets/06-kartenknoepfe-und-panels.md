---
solution:  02-SOLUTION.md
satisfies: AC-6, AC-7, AC-8, AC-11, AC-15, AC-20, AC-21, AC-23, AC-24, AC-25
after:     01-hauptansichten-mit-leiste, 02-kopfzeile-am-handy, 03-leiste-weicht-der-tastatur, 04-modus-band, 05-etb-zaehler
status:    ready
attempts:  0
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
