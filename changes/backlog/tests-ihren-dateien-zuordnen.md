---
effort: XL
complexity: M
utility: M
---

# Tests ihren Dateien zuordnen

Aufgefallen beim Schneiden von `2026-10-03-kartenpanels-auffinden` an der
Lageansicht. Eine Bestandsaufnahme am 2026-10-03 hat gezeigt, dass es den
ganzen Code betrifft. Das Ziel steht fest; offen ist, wie die einzelnen Tests
verteilt werden.

## Problem

`CODING_STANDARDS.md` verlangt, dass jede Quelldatei genau eine Testdatei hat.

**Lageansicht.** `src/map/SituationWorkspace.tsx` (229 Zeilen) hat 14
Testdateien – `SituationWorkspace.test.tsx` und 13 weitere
`SituationWorkspace.<thema>.test.tsx` (panels, layers, areas, symbols, modes,
search, map-view, …), zusammen rund 4500 Zeilen. Getestet wird darin
größtenteils Verhalten, das in anderen Dateien lebt: `SituationMapView.tsx`
(hat keine eigene Testdatei), `useMainView.ts`, `useAreaFlows`,
`useSymbolPlacement`, `useImageOverlayEditing` und weitere Hooks. Alle Tests
laufen über den ganzen Arbeitsplatz.

**Übriger Code** (Stand 2026-10-03):

- Mehrere Testdateien für eine Quelldatei: `src/journal/JournalPanel.tsx` (7),
  `src/app/operations/[id]/kml-actions.ts` (8), `src/strength/StrengthPanel.tsx`
  (6), `src/map/leaflet-adapter.ts` (5), `src/map/leaflet-areas.ts` (4),
  `src/server/journal/journal.ts` (4), `src/map/KmlPanel.tsx` (3) und 17
  weitere mit je zwei – meist eine abgespaltene `*.validation.test.ts` neben
  einer Server Action.
- Testdateien unter anderem Namen als ihre Datei: `attempt-login.test.ts`
  (gehört zu `login.ts`), `password-cost.test.ts` (`password.ts`),
  `correspondents.test.ts` und `journal-history.test.ts` (`journal.ts`),
  `security-headers.test.ts` (`next.config.ts`).
- Tests, die viele Dateien auf einmal prüfen, alle unter `src/app/`:
  `auth-enforcement`, `server-actions.validation`, `map-actions.validation`
  (eine `map-actions.ts` gibt es nicht), `foreign-operation`, `uploads`,
  `token-views.hidden-layers`, `live-connections-end`,
  `live-connection-limits`, `session-lifetime`, `token-geocode-limits`,
  `overlay-routes.not-a-uuid`.
- Testdateien über etwa 500 Zeilen: `SituationWorkspace.areas` (738),
  `SituationMap` (690), `KmlPanel` (644), `server/strength/strength-reports`
  (579), `SituationWorkspace` (569), `map-actions.validation` (568).

Was das kostet: Wer eine Datei ändert, findet ihre Tests nicht neben ihr,
sondern verstreut über andere Testdateien, und weiß nicht, ob ein fehlender
Test fehlt oder nur woanders liegt. Wer eine Server Action ändert, sieht nicht,
dass ihre Anmeldepflicht in `src/app/auth-enforcement.test.ts` und ihre
Eingabeprüfung in `src/test/bad-calls/` festgehalten sind.

## Ziel

1. **Eine Quelldatei, eine Testdatei**, daneben und mit gleichem Namen
   (`foo.ts` → `foo.test.ts`).
2. **Ist eine von beiden zu groß, werden beide geteilt** – an derselben
   Stelle, entlang dessen, was sich gemeinsam ändert.
3. **Ist nur die Testdatei zu groß, wird sie zuerst gekürzt:** gemeinsames
   Setup, tabellengetriebene Fälle, Hilfsfunktionen für wiederholte Prüfungen.
   Tests, die nur geschrieben wurden, um etwas einzuführen, und weder ein
   Kriterium festhalten noch einen versehentlichen Fehler verhindern, fallen
   weg. Vor dem Streichen das Verhalten von Hand kaputt machen: schlägt kein
   anderer Test fehl, war der Test nicht überflüssig. Erst wenn die Testdatei
   danach noch zu lang ist, wird geteilt, die Quelldatei mit.
4. **Keine Tests über viele Dateien.** Jede Datei prüft ihre Anmeldepflicht,
   Eingabeprüfung usw. in ihrer eigenen Testdatei. Gemeinsam sind nur
   Hilfsfunktionen, die die Testdateien importieren.
5. **Nichts kann ungetestet bleiben, ohne dass ein Test fehlschlägt.**

## Damit nichts vergessen wird

Dass ein Test neben seiner Datei liegt, verhindert allein nicht, dass er
vergessen wird. Die beiden größten Tests über viele Dateien zeigen beide
Seiten:

- `auth-enforcement.test.ts` führt Listen von Hand (`userGuardedActions` und
  weitere). Eine neue Action, die niemand einträgt, bleibt ungeprüft, und kein
  Test schlägt fehl.
- `server-actions.validation.test.ts` sucht jedes `"use server"`-Modul selbst
  (`src/test/server-action-modules.ts`) und schlägt fehl, wenn eine exportierte
  Action in den Tabellen fehlt. Vergessen kann man hier nichts – nur liegt die
  Prüfung nicht neben der Action.

Deshalb bekommen die Hilfsfunktionen das ganze Modul, keine Liste von Namen,
etwa:

- `expectEveryActionRequiresLogin(await import("./area-actions"))` geht über
  alle Exporte des Moduls; es gibt keine Liste, die man vergessen kann.
- `expectBadCallsRejected(module, { createAreaAction: [...], … })` prüft, dass
  die Tabelle genau die Exporte des Moduls nennt – dieselbe Prüfung wie heute
  in `server-actions.validation.test.ts`, nur je Datei.

Bleibt die Lücke, dass ein neues Modul gar keine Testdatei hat. Die schließt
ein kleiner Test, der zu jeder Quelldatei eine gleichnamige Testdatei
verlangt; er setzt zugleich Punkt 1 durch.

## Offen für die Sitzung

- Welche Tests der Lageansicht wirklich das Zusammenspiel im Arbeitsplatz
  prüfen. `SituationWorkspace.test.tsx` behält die Tests, die zeigen, dass
  Hooks und Komponenten verbunden sind – sonst prüft das niemand. Alles andere
  geht zu der Datei, deren Verhalten es festhält.
- Wo die Mocks hinkommen: Die Tests über viele Dateien mocken
  `next/headers`, `next/navigation` und die DB am Anfang der Datei. Verteilt
  auf viele Testdateien stehen sie entweder in jeder Datei oder in einem
  gemeinsamen Setup.
- Welche Dateien keine Testdatei brauchen (reine Typen, Konstanten, Seiten,
  die nur zusammensetzen) und wie der Test aus dem letzten Abschnitt sie
  ausnimmt.
- In welchen Teilen umgesetzt wird, etwa: Lageansicht; Server Actions und die
  Tests über viele Dateien; der Rest.
