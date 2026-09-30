---
effort: S
complexity: XS
utility: S
---

# Ein Datei-Eingang im Ebenen-Panel

Vorschlag aus dem Vereinfachungs-Durchgang vom 2026-09-28 (Commit `602bf31`).
Er ändert Verhalten, Oberfläche oder Tests spürbar und braucht deshalb eine
Entscheidung.

**Heute.** Das Panel „Ebenen" hat zwei getrennte Datei-Eingänge: KML/KMZ in
`KmlPanel`, PDF/PNG in `ImageOverlayPanel`, dazu eine eigene Überschrift je
Bereich.

**Vorschlag.** Ein Eingang „Datei einbinden", der nach Dateityp an KML oder
Bild-Overlay weiterreicht.

**Bringt.** Die Führungskraft muss nicht wissen, welcher Dateityp wohin
gehört; ein Bedienelement weniger.

**Kostet.** Eine Weiche nach Dateityp im Client; die Fehlermeldungen beider
Wege müssen zusammenpassen.
