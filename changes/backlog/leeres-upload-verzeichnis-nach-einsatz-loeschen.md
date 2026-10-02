---
effort: S
complexity: S
utility: S
---

# Leeres Upload-Verzeichnis nach dem Löschen eines Einsatzes

Wird ein Einsatz mit Bild-Overlays gelöscht, entfernt `deleteOverlayFiles`
(`src/server/image-overlays/image-storage.ts`) die Dateien seiner
Bild-Overlays, das Verzeichnis `data/uploads/<Einsatz-ID>/` bleibt aber leer
stehen. Mit jedem gelöschten Einsatz, der je ein Bild-Overlay hatte, kommt ein
leeres Verzeichnis dazu. Gesehen bei der Abnahme von „Ebenen und Meldungen
nachbessern“ (2026-10-02).

Gewünscht: Nach dem Löschen eines Einsatzes gibt es kein Verzeichnis
`data/uploads/<Einsatz-ID>/` mehr. Beim Löschen eines einzelnen Bild-Overlays
bleibt das Verzeichnis, solange der Einsatz besteht.
