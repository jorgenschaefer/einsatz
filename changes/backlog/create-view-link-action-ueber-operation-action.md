---
effort: XS
complexity: XS
utility: S
---

# `createViewLinkAction` über `operationAction`

Vorschlag aus dem Vereinfachungs-Durchgang vom 2026-09-28 (Commit `602bf31`).
Er ändert Verhalten, Oberfläche oder Tests spürbar und braucht deshalb eine
Entscheidung.

**Heute.** `createViewLinkAction` liefert `void` statt `ActionResult`, zeigt
keine Fehler an und sendet kein Live-Ereignis (`view-link-actions.ts`). Alle
anderen Einsatz-Mutationen laufen über `operationAction`.

**Vorschlag.** `createViewLinkAction` über `operationAction` führen;
`ViewLinkPanel` zeigt `{error}` beim Erzeugen wie die übrigen Panels.

**Bringt.** Ein Ablauf für alle Mutationen; Fehler werden sichtbar statt
verschluckt.

**Kostet.** Andere offene Clients laden bei jedem neuen Ansichtslink neu
(ein zusätzlicher Refresh, fachlich harmlos).
