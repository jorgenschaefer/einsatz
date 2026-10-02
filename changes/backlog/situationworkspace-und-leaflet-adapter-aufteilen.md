---
effort: M
complexity: S
utility: M
---

# `SituationWorkspace` und `leaflet-adapter` aufteilen

Beide Dateien sind groß und wachsen mit jeder Änderung an Karte und Ebenen:
`src/map/SituationWorkspace.tsx` hat nach „Ebenen und Meldungen nachbessern“
(2026-10-02) 509 Zeilen, `src/map/leaflet-adapter.ts` 488. Diese Änderung hat
beiden etwas hinzugefügt (Benachrichtigungen, Zurückspringen eines
Bild-Overlays, Ausschnitt für ein neues Bild-Overlay), ohne sie vorher
aufzuteilen. Gesehen beim Review dieser Änderung.

Gewünscht: Beide Dateien sind in kleinere Module aufgeteilt, ohne dass sich
das Verhalten ändert. Naheliegende Schnitte: in `SituationWorkspace` die
Panels und Kartenmodi, die heute dort verdrahtet werden; im
`leaflet-adapter` Kartenzeichen, Bereiche, KML- und Bild-Overlays, die er
heute in einer einzigen Closure je mit eigenen Layern und Signaturen pflegt,
dazu die Griffe der Bild-Overlays. Spätere Änderungen an diesen Dateien kommen
erst nach dieser Aufteilung.
