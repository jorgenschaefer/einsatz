---
solution:  02-SOLUTION.md
satisfies: AC-15, AC-22
after:     01-radius-im-editor
status:    ready
attempts:  0
---

## Build
After drawing a new circle, the Bereich-Editor opens for exactly that circle; the editor with its radius field works on a phone.

## Done when
> **AC-15** Nach dem Aufziehen eines neuen Kreises öffnet sich der Bereich-Editor für genau diesen Kreis, sobald er gespeichert ist. Nach dem Aufziehen eines Polygons oder einer Linie und nach „Form neu zeichnen" öffnet er sich nicht.

> **AC-22** Der Bereich-Editor samt Radiusfeld lässt sich auf einem Smartphone per Touch öffnen (über die Bereichsliste der Seitenleiste oder automatisch nach dem Anlegen), ausfüllen und speichern.

## Context
`handleDrawComplete` in `src/map/SituationWorkspace.tsx` resets the mode and calls `onCreateArea` (new) or `onUpdateAreaGeometry` (redraw) through `runMapAction`, which today returns nothing and reports errors via the `mapError` alert. `createAreaAction` (`src/app/operations/[id]/area-actions.ts`) discards the `Area` that `createArea` returns; `operationAction` returns only `{}` or `{ error }` and must stay unchanged (shared choke point, pinned by auth tests). The editor Modal opens whenever `selectedAreaId` points at an area present in `areas`, so setting the id before the area arrives opens it once it does. Edge cases owned: if creating fails, the error shows as today and no editor opens; a circle with radius 0 is rejected as today and no editor opens. Open concern: whether Geoman lets you create a circle by touch at all (centre tap, edge tap) is untested; the intent's C-5 was amended so this is not a gate – record what the manual check finds.

## Plan
0. runMapAction in map/SituationWorkspace.tsx returns the op's result, or `undefined` when it threw (error handling unchanged). placeSymbolAt and handleDrawComplete ignore it as today. Files: map/SituationWorkspace.tsx. Proof: covered by step 2's tests (existing error tests stay green). 04 builds on this return value.
1. createAreaAction keeps the id returned by createArea inside `run` and returns `{ ...result, id }` with its own return type `ActionResult & { id?: string }`; operationAction and ActionResult stay unchanged. Files: app/operations/[id]/area-actions.ts, new app/operations/[id]/area-actions.test.ts (pattern: kml-actions.test.ts). Proof: test "returns the id of the created area"; "returns no id on a ValidationError".
2. SituationWorkspace: `onCreateArea` prop type returns that result; handleDrawComplete, for a new circle (not redraw, not polygon/line) with a returned id, sets selectedAreaId to it, so the existing Modal opens as soon as the area appears in `areas`. Files: map/SituationWorkspace.tsx, map/SituationWorkspace.test.tsx; page.tsx needs no change (bind passes the result through). Proof: tests "opens the editor for a newly drawn circle once it arrives" (onCreateArea → {id:"a9"}, rerender with a9 → dialog „Bereich" with Radius field), "does not open the editor after drawing a polygon", "… after redrawing a circle", "… when creating fails".
3. Manual check at phone width (Chrome device emulation, 390 px, touch): open the editor from the Bereiche list and after drawing a circle, type a radius, save. Record the result, including whether drawing a circle by touch worked. Proof: the Record entry.
4. `npm run check`.

## Not here
the radius field itself (01); an additional crosshair creation path (ruled out unless touch drawing fails – then it is a new intent, not this slice); rounding (02).
