---
solution:  02-SOLUTION.md
satisfies: AC-1
after:     
status:    ready
attempts:  0
---

## Build
A drawn circle – new or redrawn – is stored with its radius rounded to whole metres.

## Done when
> **AC-1** Wird ein Kreis aufgezogen – neu oder über „Form neu zeichnen" –, wird er mit einem auf ganze Meter gerundeten Radius gespeichert, damit das Radiusfeld ihn ohne lange Nachkommastellen exakt anzeigt.

## Context
Circles are drawn with Geoman; `startDrawing` in `src/map/leaflet-adapter.ts` converts the drawn layer with `extractGeometry(shape, layer)`, which today takes `getRadius()` unrounded. Both new drawing and „Form neu zeichnen" go through this path (`SituationWorkspace.handleDrawComplete`). Rounding exists so the radius field (ticket 01) can show the value exactly without long decimals.

## Plan
1. extractGeometry rounds the circle radius with Math.round. Files: map/leaflet-adapter.ts, map/leaflet-adapter.conversion.test.ts. Proof: test "rounds a drawn circle's radius to whole metres" (463.27 → 463, 463.5 → 464); existing "reads a circle's center and radius" (250) stays green. Both new and redraw go through startDrawing → extractGeometry, so one change covers both (verified by reading SituationWorkspace.handleDrawComplete).
2. `npm run check`.

## Not here
existing stored circles are not touched (AC-13, 01); a radius rounding to 0 is rejected by the existing assertRadius as today.
