---
effort: XS
complexity: XS
utility: S
---

# KML-Sichtbarkeits-Schalter während des Speicherns sperren

Im Ebenen-Panel ist der Sichtbarkeits-Schalter eines Bild-Overlays gesperrt,
solange eine Aktion des Panels läuft (`disabled={busy}` in
`src/map/ImageOverlayPanel.tsx`). Der Schalter eines KML-Overlays in
`src/map/KmlPanel.tsx` ist es nicht. Man kann ihn also umschalten, während
noch ein Einbinden oder Neuladen läuft, und mehrfach schnell hintereinander.
Dann teilen sich mehrere Aufrufe einen Ladezustand, und der erste, der fertig
ist, beendet ihn.

Vom Review von „Einsatz-Actions vereinheitlichen“ gesehen (2026-09-30); war
schon vorher so.

Gewünscht: Der KML-Schalter ist wie der Bild-Schalter gesperrt, solange eine
Aktion des Panels läuft.
