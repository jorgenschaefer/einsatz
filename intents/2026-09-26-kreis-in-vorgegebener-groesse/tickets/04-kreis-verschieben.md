---
solution:  02-SOLUTION.md
satisfies: AC-7, AC-11, AC-16, AC-17, AC-18, AC-19, AC-20, AC-21, AC-23
after:     03-editor-nach-dem-aufziehen
status:    ready
attempts:  0
---

## Build
A circle can be moved with a fixed crosshair: „Verschieben" in the editor, pan/zoom the map under the crosshair, „Hier setzen" saves the new centre once, „Abbrechen" discards.

## Done when
> **AC-7** Der Editor zeigt bei Kreis-Bereichen den Knopf „Verschieben", bei Polygon und Linie nicht. Er schließt den Editor, klappt die Seitenleiste zu und schaltet den Verschiebe-Modus für diesen Kreis ein.

> **AC-11** Der Verschiebe-Modus schließt die anderen Karten-Modi aus (Platzieren, Bild-Overlay bearbeiten, Zeichnen): Das Einschalten eines anderen Modus beendet ihn und umgekehrt.

> **AC-16** Beim Einschalten des Verschiebe-Modus zentriert die Karte auf den Mittelpunkt des Kreises, bei unveränderter Zoomstufe. Ein Fadenkreuz steht fest in der Mitte der Karte; der Kreis wird mit unverändertem Radius um die jeweilige Kartenmitte gezeichnet und folgt jedem Schieben und Zoomen. Bis „Hier setzen" wird nichts gespeichert.

> **AC-17** „Hier setzen" speichert als neuen Mittelpunkt die Kartenmitte unter dem Fadenkreuz, mit dem Radius aus dem jüngsten Zustand, den der Client zu diesem Zeitpunkt kennt, in einem einzigen Schreibvorgang, und beendet den Modus. Die Seitenleiste bleibt danach zugeklappt.

> **AC-18** „Abbrechen" beendet den Modus ohne zu speichern; der Kreis steht wieder am gespeicherten Mittelpunkt. Die Seitenleiste bleibt zugeklappt.

> **AC-19** Fadenkreuz, „Hier setzen" und „Abbrechen" liegen über der Karte und sind auch bei zugeklappter Seitenleiste auf einem Smartphone sichtbar und per Touch bedienbar; die Karte lässt sich im Modus per Touch schieben und zoomen.

> **AC-20** Schlägt das Speichern bei „Hier setzen" fehl, wird der Fehler angezeigt und der Modus bleibt aktiv; gespeichert ist nichts, und „Abbrechen" stellt die Anzeige des gespeicherten Mittelpunkts her.

> **AC-21** Verschwindet der Kreis während des Verschiebe-Modus aus dem Zustand (z. B. von anderer Stelle gelöscht), endet der Modus; Fadenkreuz und Knöpfe verschwinden.

> **AC-23** Jede gespeicherte Änderung des Mittelpunkts erscheint live in Führungsansicht, Gerätelink- und Ansichtslink-Ansicht.

## Context
Map interaction modes live in `src/map/useMapMode.ts` (a reducer; modes are mutually exclusive). `src/map/SituationMap.tsx` owns the `MapAdapter` (`src/map/adapter.ts`, the only boundary to Leaflet; implementation in `src/map/leaflet-adapter.ts`), reconciles `areas` into `setArea`/`removeArea` on every state refresh, and already renders its own controls over the map (the map menu using `adapter.getView()`). `SituationWorkspace` holds the sidebar (`useDisclosure(true)`, 360 px wide – on a phone it covers the map) and the map error channel `runMapAction`, which ticket 03 changes to return the action's result (or `undefined` on throw). Saving goes through the existing `onUpdateAreaGeometry` → `updateAreaGeometryAction` → `operationAction` (revalidate + live publish). The image-overlay handle code is tied to image overlays and is not reused. Edge case owned: if the circle is changed elsewhere while moving, the preview keeps following the map centre and takes over a changed radius; „Hier setzen" writes with the then-known radius; a centre set elsewhere meanwhile is overwritten – last write wins.

## Plan
1. Map mode: add `{ kind: "moveCircle"; areaId: string }` with action `armMoveCircle`, control `movingCircleId`, to the reducer; any other arm/toggle/redraw replaces it, reset ends it. Files: map/useMapMode.ts, map/useMapMode.test.ts. Proof: reducer tests "arms moving a circle", "arming a draw/quick/image edit replaces moving", "arming moving replaces drawing".
2. Adapter: `MapAdapter` gets `startCirclePreview(spec: { radius: number; color: string; opacity: number }): void` and `stopCirclePreview(): void`. Leaflet implementation draws an L.circle at map.getCenter() and moves it on every map `move` event; calling start again replaces the preview (used when the radius changes); stop removes it and the listener. Files: map/adapter.ts, map/leaflet-adapter.ts, new map/leaflet-adapter.circle-preview.test.ts (real Leaflet in jsdom, pattern: leaflet-adapter.resize.test.ts); update the fake adapters in map/SituationMap.test.tsx and map/SituationWorkspace.test.tsx (and any other fake implementing MapAdapter – tsc will list them). Proof: tests "draws the preview around the map centre", "follows the map centre after setView", "stop removes the preview".
3. SituationMap: new props `movingCircleId?: string | null`, `onConfirmCircleMove?: (center: LatLng) => void`, `onCancelCircleMove?: () => void`. While set: the area is filtered out of the area reconcile (so it is removed and not re-added by live refreshes); on entering, setView to the circle's centre at the current zoom; startCirclePreview with the circle's radius/colour/opacity, restarted when those change in `areas`; renders a fixed crosshair at the map centre and buttons „Hier setzen" (calls onConfirmCircleMove with adapter.getView() lat/lng) and „Abbrechen" (Hier setzen disabled while `circleMoveBusy`), absolutely positioned over the map (zIndex 1100 like the existing controls). On leaving: stopCirclePreview; the area is reconciled back. Files: map/SituationMap.tsx, map/SituationMap.test.tsx, crosshair CSS in map/leaflet-adapter.css or inline. Proof: tests "hides the moving circle from the reconcile and previews it", "centres on the circle keeping the zoom", "Hier setzen reports the map centre", "Abbrechen reports cancel", "restores the circle when moving ends", "restarts the preview when the radius changes".
4. SituationWorkspace: AreaEditor gets an optional `onMove` (button „Verschieben", only rendered when given, which the workspace does for circles only); it closes the editor, closes the sidebar, arms moveCircle. onConfirmCircleMove calls `onUpdateAreaGeometry(id, { shape: "circle", center, radius: <radius of that area in the current areas prop> })` via runMapAction and uses its returned result; on success resetMode (sidebar stays closed), on error or throw the mapError alert shows and the mode stays. While the save is in flight a busy flag is passed to SituationMap (new prop `circleMoveBusy`), which disables „Hier setzen". onCancelCircleMove → resetMode. An effect ends the mode when the moving id is no longer in `areas`. Files: map/AreaEditor.tsx (+test), map/SituationWorkspace.tsx (+test). Proof: tests "offers Verschieben only for circles", "Verschieben closes the editor and the sidebar and starts moving", "Hier setzen saves the centre with the latest radius once and ends moving, sidebar still closed", "a second tap while saving does not write again", "a failed save keeps moving and shows the error", "Abbrechen ends moving without saving, sidebar still closed", "ends moving when the circle disappears", "starting to draw ends moving".
5. AC-23 live: no new code. Proof: step 4's test that „Hier setzen" calls onUpdateAreaGeometry (bound in page.tsx to updateAreaGeometryAction) exactly once, plus the existing operation-action.test.ts pinning revalidate + publish.
6. Manual check at phone width (Chrome device emulation, 390 px, touch): Verschieben, pan/zoom by touch, Hier setzen, Abbrechen; crosshair and buttons visible with the sidebar closed. Record the result.
7. `npm run check`.

## Not here
moving polygons/lines; moving several circles together; showing the old circle while moving; a metre label; radius field (01).
