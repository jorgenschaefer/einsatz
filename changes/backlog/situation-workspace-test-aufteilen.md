# Laufzeit von `SituationWorkspace.test.tsx`

Vorschlag aus dem Vereinfachungs-Durchgang vom 2026-09-28 (Commit `602bf31`).
Er ändert Verhalten, Oberfläche oder Tests spürbar und braucht deshalb eine
Entscheidung.

**Heute.** Die Datei läuft allein rund 55 s (120 Tests); die teuren benannten
Rollenabfragen sind durch Label-/Textabfragen ersetzt, geschlossene
`Select`-Dropdowns halten keine Optionen mehr im DOM. Der Rest ist
React-Rendering im Dev-Build, gut ein Viertel davon die Owner-Stacks (ein
`Error` je Element). Allein laufen die langsamsten Tests um 1 s; weil Vitest
nach Dateien parallelisiert, ist die Datei im Gesamtlauf der längste Posten.

**Vorschlag.** Die Datei nach Themen aufteilen (Hauptansicht, Kartenzeichen,
Bereiche, Bild-Overlays), damit sie sich auf die Worker verteilt.

**Bringt.** Ein verlässlicher `npm run check` auch auf ausgelasteten
Maschinen.
