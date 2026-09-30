---
effort: S
complexity: XS
utility: XS
---

# Pflicht-Props statt optionaler Test-Erleichterungen

Vorschlag aus dem Vereinfachungs-Durchgang vom 2026-09-28 (Commit `602bf31`).
Er ändert Verhalten, Oberfläche oder Tests spürbar und braucht deshalb eine
Entscheidung.

**Heute.** Einige Props sind nur optional, damit Test-Fixtures sie weglassen
können, obwohl die Produktion sie immer setzt:

- `positionSource`, `reportedAt`, `deviceLinkToken` an `WorkspaceSymbol` und
  `StatefulSymbol` (daher `?? "manual"` / `?? null` im Code),
- `viewLinks`, `onCreateViewLink`, `onDeleteViewLink` an
  `SituationWorkspace` und `LageansichtShell` (mit `noop`-Defaults).

**Vorschlag.** Als Pflicht-Props führen und die Fixtures ergänzen.

**Bringt.** Der Typ sagt, was wirklich immer da ist; die Fallbacks entfallen.

**Kostet.** Änderungen in mehreren Test-Fixtures, vor allem in
`SituationWorkspace.fixtures.tsx` und den Tests von `SymbolDetailModal`.
