---
criteria:  CRITERIA.md
closes:    AC-1
advances:
after:
status:    done
attempts:  1
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
- **AC-1 in the three views and "no script runs" have no automated test.** The
  tests run at the adapter (`leaflet-markers.test.ts`,
  `leaflet-areas.label.test.ts`), which all three views share. The reviewer
  checked the rest in the running app (plan step 5) at 390×844 and 1280×800,
  using a Kartenzeichen and a polygon Bereich both labelled
  `<img src=x onerror=alert(1)>`. In the Lageansicht, the Ansichtsansicht
  (Ansichtslink, logged out) and the Geräteansicht (Gerätelink, logged out),
  the literal text showed in a `<span>`. No `<img>` was created, no alert came
  up, and no request went to `…/x`. The Kartenzeichen label still sits to the
  right of the symbol: 14px bold, white halo, no box. The Bereich label is still
  centred, in Leaflet's white box. The reviewer compared computed styles, not
  screenshots of the old code.
- **Review nit not fixed:** the Leaflet test map setup (a container with
  `clientWidth`/`clientHeight`, then `leafletMapAdapterFactory.create`) is now
  copied into two more tests, making nine copies under `src/map`. One helper for
  all of them would mean refactoring seven tests this ticket does not touch, so
  it is better as a separate change.
- **Plan detail:** the plan put a `span` into `applyLabel` and `applyAreaStyle`
  separately. Both now call one helper, `tooltipText` in
  `src/map/tooltip-text.ts`, because the two must not drift apart. The area test
  went into a new `leaflet-areas.label.test.ts`, as the plan allowed. The shared
  assertion is in `src/map/tooltip.fixtures.ts`.
- Unrelated, seen during review: the Geräteansicht logs a React hydration
  mismatch on the search input (`caret-color: transparent`). It is probably
  caused by the test browser, and I have not looked into it.
