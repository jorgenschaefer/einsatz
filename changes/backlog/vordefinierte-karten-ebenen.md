---
effort: L
utility: L
---

# Vordefinierte Karten-Ebenen

Wunsch des Nutzers. Hier steht nur das Problem, noch keine Lösung.

Manche Ebenen braucht man in fast jedem Einsatz: Standorte der Feuerwehr,
andere Rettungswachen, Standorte von PTZ-/PAL-Ressourcen, Krankenhäuser usw.
Sie sollen einmal vorab angelegt werden und sich dann in einem Einsatz
einfach einblenden lassen.

Diese Daten gibt es oft nicht als Datei. Die Ebenen müssen sich deshalb im
Tool selbst erstellen lassen, also Standorte setzen und benennen, ohne dass
ein Einsatz offen ist. Ob es zusätzlich einen KML-Import gibt, ist Sache der
Lösung.

Heute gehört jedes Kartenobjekt zu genau einem Einsatz: KML-Ebenen
(`kml_overlays.operation_id … ON DELETE CASCADE` in
`src/server/db/migrations/006_kml_overlays.sql`), Bild-Overlays (`007`) und
Kartenzeichen (`src/server/mapsymbols/`). Wer heute Feuerwehrstandorte auf der
Karte haben will, muss sie in jedem Einsatz neu anlegen oder importieren. Ein
früheres POI-Feature (`004_pois.sql`) hing ebenfalls am Einsatz und wurde
wieder entfernt (`009_drop_pois.sql`).
