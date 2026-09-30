---
effort: S
complexity: XS
utility: S
---

# Ein Muster für „beschäftigt/Fehler"

Vorschlag aus dem Vereinfachungs-Durchgang vom 2026-09-28 (Commit `602bf31`).
Er ändert Verhalten, Oberfläche oder Tests spürbar und braucht deshalb eine
Entscheidung.

**Heute.** Dasselbe Muster aus `busy`, `error`, try/catch/finally steht in
mehreren leicht abweichenden Varianten: `run` in `KmlPanel` und
`ImageOverlayPanel` (identisch), `save` in `SymbolDetailModal` und
`AreaEditorModal`, `persistImage` in `SituationWorkspace`, `saveDefault` in
`MapControls`, dazu mehrere Handler in
`JournalPanel`.

**Vorschlag.** Ein kleiner Hook (etwa `useActionRunner`), der `busy`,
`error` und das Ausführen einer `ActionResult`-Action kapselt.

**Bringt.** Gleiche Fehlerbehandlung überall, besonders für geworfene Fehler
(heute fangen manche Varianten sie ab, andere nicht).

**Kostet.** Die Varianten unterscheiden sich in Details (schließen bei Erfolg
ja/nein, Fallback-Text); der Hook braucht dafür Optionen. Nur lohnend, wenn
die Unterschiede sich als zufällig statt gewollt herausstellen.
