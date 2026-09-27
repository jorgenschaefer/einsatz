---
solution:  02-SOLUTION.md
satisfies: AC-15, AC-22
after:     01-radius-im-editor
status:    done
attempts:  1
---

## Build
After drawing a new circle, the Bereich-Editor opens for exactly that circle; the editor with its radius field works on a phone.

## Done when
> **AC-15** Nach dem Aufziehen eines neuen Kreises öffnet sich der Bereich-Editor für genau diesen Kreis, sobald er gespeichert ist. Nach dem Aufziehen eines Polygons oder einer Linie und nach „Form neu zeichnen" öffnet er sich nicht.

> **AC-22** Der Bereich-Editor samt Radiusfeld lässt sich auf einem Smartphone per Touch öffnen (über die Liste im Bereiche-Panel oder automatisch nach dem Anlegen), ausfüllen und speichern.

## Context
`handleDrawComplete` in `src/map/SituationWorkspace.tsx` resets the mode and calls `onCreateArea` (new) or `onUpdateAreaGeometry` (redraw) through `runMapAction`, which today returns nothing and reports errors via the `mapError` alert. `createAreaAction` (`src/app/operations/[id]/area-actions.ts`) discards the `Area` that `createArea` returns; `operationAction` returns only `{}` or `{ error }` and must stay unchanged (shared choke point, pinned by auth tests). The editor Modal opens whenever `selectedAreaId` points at an area present in `areas`, so setting the id before the area arrives opens it once it does. On a phone, choosing a shape in the Bereiche panel already closes the panel sheet (`toggleAreaDraw` → `closeSheetOnPhone`), so nothing covers the editor when it opens after drawing. Edge cases owned: if creating fails, the error shows as today and no editor opens; a circle with radius 0 is rejected as today and no editor opens. Open concern: whether Geoman lets you create a circle by touch at all (centre tap, edge tap) is untested; the intent's C-5 was amended so this is not a gate – record what the manual check finds.

## Plan
0. runMapAction in map/SituationWorkspace.tsx returns the op's result, or `undefined` when it threw (error handling unchanged). placeSymbolAt and handleDrawComplete ignore it as today. Files: map/SituationWorkspace.tsx. Proof: covered by step 2's tests (existing error tests stay green). 04 builds on this return value.
1. createAreaAction keeps the id returned by createArea inside `run` and returns `{ ...result, id }` with its own return type `ActionResult & { id?: string }`; operationAction and ActionResult stay unchanged. Files: app/operations/[id]/area-actions.ts, new app/operations/[id]/area-actions.test.ts (pattern: kml-actions.test.ts). Proof: test "returns the id of the created area"; "returns no id on a ValidationError".
2. SituationWorkspace: `onCreateArea` prop type returns that result; handleDrawComplete, for a new circle (not redraw, not polygon/line) with a returned id, sets selectedAreaId to it, so the existing Modal opens as soon as the area appears in `areas`. Files: map/SituationWorkspace.tsx, map/SituationWorkspace.test.tsx; page.tsx needs no change (bind passes the result through). Proof: tests "opens the editor for a newly drawn circle once it arrives" (onCreateArea → {id:"a9"}, rerender with a9 → dialog „Bereich" with Radius field), "does not open the editor after drawing a polygon", "… after redrawing a circle", "… when creating fails".
3. Manual check at phone width with the `run-einsatz` skill (Playwright driver, phone viewport, touch): open the editor from the Bereiche panel list and after drawing a circle, type a radius, save. Record the result, including whether drawing a circle by touch worked. Proof: the Record entry.
4. `npm run check`.

## Not here
the radius field itself (01); an additional crosshair creation path (ruled out unless touch drawing fails – then it is a new intent, not this slice); rounding (02).

## Record
Criteria → tests (`src/map/SituationWorkspace.test.tsx` › "opening the area editor after drawing" = SW; `src/app/operations/[id]/area-actions.test.ts` = AA):
- **AC-15** AA "returns the id of the created area", AA "returns no id on a ValidationError"; SW "opens the editor for a newly drawn circle once it arrives" (dialog „Bereich" with Radius „250 m"), SW "does not open the editor after drawing a Polygon / Linie" (it.each), SW "does not open the editor after redrawing a circle", SW "shows the new circle, not the area opened while it was being created".
- Owned edge cases: SW "does not open the editor when creating fails" (radius 0 rejected, error shown, area re-rendered, no dialog), SW "… when creating throws" (fallback alert, no dialog).
- **AC-22** Manual check (plan step 3), `run-einsatz` Playwright driver patched to a touch phone context (390×844, `hasTouch`, `isMobile`): editor opened from the Bereiche list by tapping the pencil, radius typed (1500), Speichern tapped, value stored (survives reload); after drawing a circle by touch the editor opened by itself, radius typed (300), saved, reopened showing „300 m". Drawing a Polygon opened no editor. No console errors.
  - **Touch drawing (open concern):** a circle can be created by touch with two taps (centre, then edge). A touch drag does *not* draw – it pans the map. Geoman's hint texts are English („Click to finish circle").

Command: `npm run check` — green (tsc, biome, 776/776 vitest).

Departures from the plan:
- `runMapAction` became generic over the result type (`<R extends ActionResult>`) so `handleDrawComplete` sees `id`; the redraw path now returns early instead of sharing one `runMapAction` call.
- Beyond the plan, from review: `AreaEditor` is keyed by area id (round-2 blocker: when the create result arrived while another area's editor was open and the new area was already in `areas`, the editor switched to the new circle but kept the old area's colour/label/radius-at-open, so Speichern would write them onto the new circle). `startRedraw` now clears `areaError` (round-1 nit: an earlier save error showed in the new circle's editor).
- The four negative SW tests passed on first run (guards, not red steps); each was checked to fail against a mutant (dropping the circle check fails Polygon/Linie; ignoring the result fails fails/throws).

Left standing:
- Review round 2 nit, not fixed: `areaError` can still survive when the open area is deleted by someone else (Modal closes without `onClose`); the next editor would show it. Pre-existing route, outside this ticket's flow.
- Review round 2 nit, not fixed: `ActionResult & { id?: string }` is written twice (area-actions.ts, SituationWorkspace.tsx props). Kept inline; one name for one use-pair did not seem worth a new export.
- Manual-check observations, not investigated: the Modal's „Schließen" button did not respond to a Playwright tap (Escape worked); right after the edge tap, the drawn circle and modal appeared only ~0.5–1 s later (dev-mode rendering). The Bereiche list does not show the radius (not asked for).
- The first full `npm run check` reported an unhandled Mantine transition-timer error from untouched `src/map/KmlPanel.test.tsx` while a dev server and browser ran in parallel; it passes alone and both later full runs were clean.
