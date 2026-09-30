---
effort: XS
complexity: XS
utility: S
---

# KML-Punkte ohne eigenes Symbol zeigen ein kaputtes Bild

Enthält eine eingebundene KML-Datei einen Punkt ohne `<IconStyle>`, setzt
`parseKml` in `src/map/leaflet-adapter.ts` dafür Leaflets Standardmarker
(`L.marker(latlng)`). Leaflet lädt dessen Bilder `marker-icon.png` und
`marker-shadow.png` über einen relativen Pfad, in der Lageansicht also von
`/operations/marker-icon.png`. Diese Adresse landet in der Route
`/operations/[id]` mit `marker-icon.png` als Einsatz-ID und antwortet mit 500
(`invalid input syntax for type uuid`). Auf der Karte erscheint an der Stelle
ein kaputtes Bild, der Punkt ist kaum zu erkennen.

Aufgefallen beim Review der Änderung
`2026-09-30-ziel-erkennbar-und-erreichbar` im Browser; die Änderung selbst hat
damit nichts zu tun.

Zwei Dinge daran: Der Standardmarker braucht eine Bildquelle, die unter jeder
Route funktioniert, und eine Einsatz-ID, die keine UUID ist, sollte als „nicht
gefunden“ enden statt mit einem Serverfehler.
