---
criteria:  CRITERIA.md
closes:    AC-1
advances:
after:
status:    ready
attempts:  0
---

## Build
The permanent tooltips on the Lagekarte - the Bezeichnung of a Kartenzeichen
and the Beschriftung of a Bereich - are handed to Leaflet as a DOM node whose
text is set with `textContent`, instead of as a string Leaflet puts into
`innerHTML`.

## Done when
> **AC-1** Enthält die Bezeichnung eines Kartenzeichens oder die Beschriftung eines Bereichs HTML (etwa `<img src=x onerror=alert(1)>`), steht auf der Lagekarte – in Lageansicht, Ansichtsansicht und Geräteansicht – genau dieser Text; kein Element entsteht, kein Skript läuft.

## Nudges
> Tooltips bekommen einen DOM-Knoten mit `textContent`, wie `kmlPopupContent` in `src/map/kml-layer.ts`.

## Context
- **Where the labels are drawn.** `src/map/leaflet-markers.ts`,
  `applyLabel(marker, label)`, calls `marker.bindTooltip(label, { permanent:
  true, direction: "right", className: "kartenzeichen-label" })`.
  `src/map/leaflet-areas.ts`, `applyAreaStyle(layer, spec)`, calls
  `layer.bindTooltip(spec.label, { permanent: true, direction: "center" })`.
  Leaflet treats a string tooltip content as HTML (`innerHTML`); an
  `HTMLElement` is appended as is. That is the whole hole.
- **One rendering path for all three views.** Lageansicht
  (`SituationWorkspace`), Ansichtsansicht (`ViewLinkView` via
  `ReadOnlySituationMap`) and Geräteansicht (`DeviceView` via
  `ReadOnlySituationMap`) all render `src/map/SituationMap.tsx`, which loads
  `leafletMapAdapterFactory` from `src/map/leaflet-adapter.ts` and passes
  `symbol.label` / `area.label` through unchanged to `setMarker` / `setArea`
  (see the two reconcile effects). The adapter is therefore the single place
  where the label becomes DOM, and the place to prove AC-1 for all three views.
- **Specimen.** `kmlPopupContent` in `src/map/kml-layer.ts` builds its popup
  with `document.createElement` and `textContent`. Follow that.
- **Existing test pattern.** `src/map/leaflet-markers.test.ts` creates a real
  Leaflet map in jsdom through `leafletMapAdapterFactory.create(container, …)`,
  calls `adapter.setMarker(…)` and inspects `.leaflet-tooltip-right`. Use the
  same pattern for areas with `adapter.setArea(…)`.
- A marker keeps its tooltip across reconciles and rebinds it only when the
  signature changes (`applyLabel` unbinds first). A DOM node can only sit in one
  place, so each bind needs a fresh node.

## Plan
1. **Red: Kartenzeichen label with HTML.** In `src/map/leaflet-markers.test.ts`
   add a test that sets a marker with `label: "<img src=x onerror=alert(1)>"`
   through `leafletMapAdapterFactory` and asserts: the tooltip's `textContent`
   is exactly that string, and the tooltip contains no element other than the
   label node itself (`tooltip.querySelector("img")` is null, no child element
   below the text node holder). Also a second `setMarker` with a changed HTML
   label (signature change → rebind) shows the new text verbatim.
   *Proof:* the test fails today (an `<img>` is created, `textContent` is
   empty).
2. **Green: marker label as a DOM node.** In `applyLabel`
   (`src/map/leaflet-markers.ts`) create a `span`, set `textContent = label`,
   and bind that. Keep the options and the `kartenzeichen-label` class.
   *Proof:* step 1 green; the existing "places the Bezeichnung tooltip to the
   right" test stays green (position and class unchanged).
3. **Red: Bereich Beschriftung with HTML.** In `src/map/leaflet-areas.test.ts`
   (or a new `src/map/leaflet-areas.label.test.ts` if the existing file reads
   better without a map instance - it currently tests `extractGeometry` with
   bare layers) set an area with `label: "<img src=x onerror=alert(1)>"`
   through `leafletMapAdapterFactory` and assert the same as step 1 on its
   `.leaflet-tooltip`.
   *Proof:* fails today.
4. **Green: area label as a DOM node.** In `applyAreaStyle`
   (`src/map/leaflet-areas.ts`) bind a fresh `span` with `textContent`.
   *Proof:* step 3 green.
5. **Look at it.** With the `run-einsatz` skill (`.claude/skills/run-einsatz/SKILL.md`)
   create a Kartenzeichen with Bezeichnung `<img src=x onerror=alert(1)>` and a
   Bereich with that Beschriftung; open the Lageansicht, a Ansichtslink and a
   Gerätelink. The literal text shows next to the symbol and in the Bereich, no
   broken image, no alert. Check that the label still looks as before (halo,
   font size from `leaflet-markers.css`, which targets the tooltip, not its
   content).
   *Proof:* observation recorded under `## Left standing`.
6. `npm run check` green.

## Not here
- Server-side validation of Bereich label length and colour (`#rrggbb`) and of
  Kartenzeichen fields: ticket `23-kartenobjekte-eingaben`. This ticket changes
  only how the text is drawn.
- The Content-Security-Policy that would also stop such a script: ticket
  `05-sicherheits-header`.
- KML popups already use `textContent` (`kmlPopupContent`); nothing to do there.

## Left standing
