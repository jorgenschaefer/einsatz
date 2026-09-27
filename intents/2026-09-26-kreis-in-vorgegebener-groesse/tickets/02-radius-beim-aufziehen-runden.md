---
solution:  02-SOLUTION.md
satisfies: AC-1
after:     
status:    done
attempts:  1
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

## Record
Criteria → tests (`src/map/leaflet-adapter.conversion.test.ts` › extractGeometry):
- **AC-1** "rounds a drawn circle's radius of %s to %s whole metres" (it.each: 463.27 → 463, 463.5 → 464, 0.4 → 0); existing "reads a circle's center and radius" (250) still green. New drawing and „Form neu zeichnen" both reach `extractGeometry` via its only caller, `startDrawing`'s `pm:create` handler; `SituationWorkspace.handleDrawComplete` then routes to `onCreateArea` or `onUpdateAreaGeometry` – so one change covers both (checked by reading, as the plan said).

Command: `npm run check` — green (tsc, biome, 766/766 vitest).

Departures from the plan: added a third case, 0.4 → 0, which makes visible that a sub-half-metre circle arrives at the server as radius 0 and is rejected by `assertRadius` as today (Not here). No new handling for it.

Left standing:
- Review (fresh-context critique): clean – no blockers, should-fix or nits. Its one tradeoff note: the 0.4 → 0 case pins a value that can never be stored; kept, since it documents the handoff to `assertRadius`.
- The `pm:create` → `extractGeometry` wiring in `startDrawing` is untested (Geoman adapter edge; unchanged by this diff). Not verified by drawing a circle in a real browser.
