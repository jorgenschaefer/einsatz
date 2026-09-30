---
effort: S
complexity: XS
utility: XS
---

# Catch-all der KML- und Bild-Actions in `operationAction`

Vorschlag aus dem Vereinfachungs-Durchgang vom 2026-09-28 (Commit `602bf31`).
Er ändert Verhalten, Oberfläche oder Tests spürbar und braucht deshalb eine
Entscheidung.

**Heute.** `addKmlFileAction`, `addKmlUrlAction`, `reloadKmlAction` und die
Bild-Overlay-Actions wiederholen denselben Block aus `requireUser`,
try/catch, `revalidateOperation` und `toFormError`, weil `operationAction`
unerwartete Fehler weiterwirft statt eine freundliche Meldung zu liefern.

**Vorschlag.** `operationAction` erhält eine optionale Fallback-Meldung für
unerwartete Fehler; die Actions nutzen sie.

**Bringt.** Rund 40 Zeilen weniger und ein einziger Choke-Point für
Anmeldung, Revalidierung und Fehlerübersetzung.

**Kostet.** Die Sonderfälle bleiben: `deleteImageOverlayAction` revalidiert
auch bei gescheitertem Datei-Aufräumen, und die Bild-Actions protokollieren
unerwartete Fehler. Beides muss erhalten bleiben und getestet sein.
