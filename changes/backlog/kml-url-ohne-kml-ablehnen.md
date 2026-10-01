---
effort: S
complexity: S
utility: M
---

# Eine KML-URL, die kein KML liefert, wird angenommen

Bindet man im Ebenen-Panel eine URL ein, die auf eine gewöhnliche Webseite
zeigt (z. B. `https://example.org/`), entsteht ohne Meldung ein KML-Overlay.
Auf der Karte erscheint nichts, und wer die Liste sieht, hält die Ebene für
eingebunden. `fetchKmlFromUrl` in `src/server/kml/kml-fetch.ts` prüft Status,
Größe und ob es ein KMZ-Archiv ist; ist es keins, nimmt `extractKml` in
`src/kml/kmz.ts` den Inhalt unbesehen als Text.

Gesehen beim Review von „Einsatz-Actions vereinheitlichen“ am 2026-09-30.

Gewünscht: Liefert die URL kein KML, wird sie mit einer Meldung abgelehnt, und
es entsteht kein Overlay. Beim Neuladen einer bestehenden URL entsprechend:
Liefert sie inzwischen kein KML mehr, bleibt der alte Inhalt, und es erscheint
eine Meldung. Zu klären ist, ob dieselbe Prüfung auch für hochgeladene
KML-Dateien gilt.
