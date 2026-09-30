---
effort: XS
complexity: XS
utility: XS
---

# Gleicher Tap auf ein Kartenzeichen in beiden Nur-Lesen-Ansichten

Vorschlag aus dem Vereinfachungs-Durchgang vom 2026-09-28 (Commit `602bf31`).
Er ändert Verhalten, Oberfläche oder Tests spürbar und braucht deshalb eine
Entscheidung.

**Heute.** In der Geräteansicht öffnet ein Tap auf ein Zeichen die Karten-App
des Handys (Navigation), in der Ansichtslink-Ansicht zentriert er nur die
Karte.

**Vorschlag.** Klären, ob der Unterschied fachlich gewollt ist. Geräte sind
unterwegs (Navigation sinnvoll), Mitleser sitzen eher in der Leitstelle
(Zentrieren sinnvoll) – dann bleibt es so und ist nur zu dokumentieren.
Andernfalls ein Verhalten für beide.

**Bringt.** Bei Vereinheitlichung ein Konzept weniger; `onSelect` entfiele
als Parameter von `ReadOnlySituationMap`.

**Kostet.** Wird vereinheitlicht, verliert eine der beiden Gruppen ihr
heutiges Verhalten.
