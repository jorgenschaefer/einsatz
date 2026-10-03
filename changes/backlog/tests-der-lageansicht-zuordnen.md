---
effort: L
complexity: M
utility: M
---

# Tests der Lageansicht ihren Dateien zuordnen

Aufgefallen beim Schneiden von `2026-10-03-kartenpanels-auffinden`. Hier steht
nur das Problem, noch keine Lösung.

`CODING_STANDARDS.md` verlangt, dass jede Quelldatei genau eine Testdatei hat.
Für die Lageansicht gilt das nicht: `src/map/SituationWorkspace.tsx` (213
Zeilen) hat 14 Testdateien – `SituationWorkspace.test.tsx` und 13 weitere
`SituationWorkspace.<thema>.test.tsx` (panels, layers, areas, symbols, modes,
search, map-view, …), zusammen rund 4300 Zeilen. Getestet wird darin
größtenteils Verhalten, das in anderen Dateien lebt: `SituationMapView.tsx`
(hat keine eigene Testdatei), `useMainView.ts`, `useAreaFlows`,
`useSymbolPlacement`, `useImageOverlayEditing` und weitere Hooks. Alle Tests
laufen über den ganzen Arbeitsplatz.

Was das kostet: Wer eine dieser Dateien ändert, findet ihre Tests nicht neben
ihr, sondern verstreut über die Workspace-Tests, und weiß nicht, ob ein
fehlender Test fehlt oder nur woanders liegt. `SituationWorkspace.areas.test.tsx`
hat 738 Zeilen und liegt damit selbst über der Grenze von etwa 500 Zeilen.

Offen für die Sitzung: welche Tests wirklich das Zusammenspiel im Arbeitsplatz
prüfen und dort bleiben sollen, und welche zu der Datei gehören, deren
Verhalten sie festhalten.
