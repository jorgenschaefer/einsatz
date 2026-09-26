---
solution:  02-SOLUTION.md
satisfies: AC-2, AC-3, AC-4, AC-5, AC-6, AC-12, AC-13
after:     
status:    ready
attempts:  0
---

## Build
The Bereich-Editor shows a circle's radius in metres and saves a changed
radius around the latest known centre.

## Done when
> **AC-2** Der Bereich-Editor zeigt bei einem Kreis-Bereich ein Feld „Radius" mit dem gespeicherten Radius in Metern, exakt und ohne Rundung (deutsches Dezimalkomma). Bei Polygon und Linie gibt es das Feld nicht.

> **AC-3** Wird im Feld ein anderer Wert eingegeben und gespeichert, hat der Kreis danach genau diesen Radius um den Mittelpunkt aus dem jüngsten Zustand, den der Client beim Speichern kennt – nicht um den beim Öffnen des Editors (ein zwischenzeitliches Verschieben von anderer Stelle bleibt also erhalten). Das gilt für einen gerade aufgezogenen Kreis ebenso wie für einen älteren.

> **AC-4** Wird gespeichert und das Radiusfeld hat noch den Wert, den es beim Öffnen des Editors hatte, wird die Geometrie nicht geschrieben – nur der Stil. Ein zwischenzeitlich von anderer Stelle geänderter Radius wird so nicht überschrieben.

> **AC-5** Farbe, Deckkraft und Beschriftung lassen sich im selben Editor wie bisher ändern und speichern.

> **AC-6** Ein ungültiger Radius (leer, 0, negativ) wird nicht gespeichert; der Editor zeigt einen Fehler und bleibt offen.

> **AC-12** Jede gespeicherte Änderung des Radius erscheint live in Führungsansicht, Gerätelink- und Ansichtslink-Ansicht.

> **AC-13** Kreis-Bereiche, die vor der Änderung angelegt wurden, werden mit unverändertem Mittelpunkt und Radius angezeigt; nichts schreibt sie um, solange niemand ihren Radius oder Mittelpunkt ändert.

## Context
The Bereich-Editor (`src/map/AreaEditor.tsx`) is a Mantine Modal opened from the Bereiche tab in `src/map/SituationWorkspace.tsx` (`selectedAreaId` → `selectedArea` derived from the `areas` prop, so it stays live). Today it edits colour, opacity and label via `onSave(style)` → `runArea(() => onUpdateAreaStyle(...))`, plus „Form neu zeichnen" and „Löschen". Circle geometry is `{ shape: "circle"; center; radius }` in metres (`src/map/area.ts`); the server validates with `assertRadius` (finite, > 0) in `src/server/areas/areas.ts`. `onUpdateAreaGeometry` is bound in `src/app/operations/[id]/page.tsx` to `updateAreaGeometryAction`, which goes through `operationAction` (revalidate + live publish, pinned in `operation-action.test.ts`). Existing circles may carry fractional radii (e.g. 463.27) from drawing; they must not be rewritten unless the user changes them. Edge cases owned: saving with a changed radius writes geometry first; if it fails the style is not written; if the style fails afterwards the radius is saved and the editor shows the error. No upper bound on the radius beyond `assertRadius`.

## Plan
1. AreaEditor gets an optional `radius` prop (present only for circles) and renders a Mantine NumberInput „Radius" with `decimalSeparator=","`, no decimalScale, suffix/unit „m"; absent for polygon/line. Files: map/AreaEditor.tsx, map/AreaEditor.test.tsx. Proof: tests "shows the radius of a circle exactly with a decimal comma" (e.g. 463.27 → "463,27"), "shows no radius field without a radius".
2. onSave signature becomes `onSave(style, radius?)` where `radius` is passed only when the field differs from the value at open; empty/0/negative shows an Alert in the editor and does not call onSave. Files: map/AreaEditor.tsx + test. Proof: tests "passes a changed radius", "passes no radius when unchanged", "rejects empty, 0 and negative radius with an error and does not save" (three cases), existing "saves edited style" still green.
3. SituationWorkspace: pass `radius` for circle areas into AreaEditor; its onSave handler, when a radius is given, first calls `onUpdateAreaGeometry(id, { shape: "circle", center: <selectedArea.geometry.center from the current `areas` prop>, radius })`, stops on `{error}`/throw (style not written), then calls `onUpdateAreaStyle` as today; without a radius only `onUpdateAreaStyle`. Uses the existing runArea error channel. Files: map/SituationWorkspace.tsx, map/SituationWorkspace.test.tsx. Proof: tests "saves a changed radius around the centre the client currently knows" (rerender areas with a moved centre while the editor is open, then save → geometry has the new centre), "saves only the style when the radius is unchanged" (legacy 463.27 circle: onUpdateAreaGeometry not called – pins AC-4/AC-13), "does not write the style when the radius save fails", "shows the error when the style fails after the radius was saved".
4. Live path for AC-12: no new code. updateAreaGeometryAction runs through operationAction, whose revalidate + publish is already pinned by app/operations/[id]/operation-action.test.ts; page.tsx binds onUpdateAreaGeometry to updateAreaGeometryAction. Proof: step 3's test that onUpdateAreaGeometry is called with the new radius, plus the existing operation-action test. (No red step possible – existing behaviour, named here.)
5. `npm run check`.

## Not here
rounding on drawing (02); editor opening after drawing (03); Verschieben (04); radius as a number in Gerätelink/Ansichtslink views (non-goal); no protection of style fields against concurrent changes (non-goal).
