---
effort: XS
complexity: XS
utility: S
---

# Eine alte Fehlermeldung im Ebenen-Panel bleibt stehen

Scheitert im Ebenen-Panel das Einbinden eines Bild-Overlays, steht „Das Bild
konnte nicht eingebunden werden.“ über der Liste. Öffnet man danach den Editor
eines vorhandenen Overlays und arbeitet dort, bleibt die Meldung stehen,
obwohl sie zu einem Vorgang gehört, den man längst aufgegeben hat. Sie
verschwindet erst mit der nächsten Aktion desselben Panels. Gleiches gilt für
die Meldungen im KML-Teil des Panels.

Aufgefallen bei der Abnahme von „Einsatz-Actions vereinheitlichen“ am
2026-09-30; die Meldungen kommen aus `useActionRunner` in
`src/map/ImageOverlayPanel.tsx` und `src/map/KmlPanel.tsx`.

Vorschlag: Die Meldung eines Panels verschwindet, sobald man im Panel etwas
anderes beginnt, etwa ein Overlay zum Bearbeiten öffnet.
