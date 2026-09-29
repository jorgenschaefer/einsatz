---
solution:  02-SOLUTION.md
satisfies: AC-2, AC-12, AC-11
after:     01-seitenleiste-am-desktop
status:    ready
attempts:  0
---

## Build

Am Desktop ist das ETB-Eingabefeld immer bereit: Jeder Klick auf „ETB" in
der Seitenleiste setzt den Cursor hinein, und das Feld samt Knopf steht fest
unten in der ETB-Ansicht, die Einträge scrollen darüber. Am Smartphone
ändert sich nichts.

## Done when

> **AC-2** Jeder Klick auf „ETB" in der Seitenleiste setzt am Desktop den
> Cursor in das Textfeld für einen neuen Eintrag, auch wenn das ETB schon
> gezeigt wird.

> **AC-12** Zeigt die Seitenleiste am Desktop das ETB, ist das Textfeld für
> einen neuen Eintrag samt Absende-Knopf sichtbar, ohne zu scrollen, auch bei
> langem ETB. Die Einträge scrollen darüber.

> **AC-11** Am Smartphone (unter 48 em) verhält sich alles wie vor dieser
> Änderung: Leiste unten mit Lagekarte, ETB und Stärke, Startansicht ETB,
> Kartenpanel als Blatt über der Karte mit „Schließen", kein automatischer
> Cursor im ETB-Feld.

(AC-11 ist schon in Ticket 01 beansprucht; hier als Schutz, weil nur dieses
Ticket Autofokus und das feste Feld aufs Smartphone durchlassen kann.)

## Context

Ein ETB-Eintrag von der Karte aus soll am Desktop höchstens einen Klick
kosten, außer Tippen und Absenden (Intent C-1). Nach Ticket 01 steht das ETB
in der Seitenleiste neben der Karte. Offen bleiben zwei Lücken: Zeigt die
Seitenleiste „Lagekarte" oder „Stärke", wären es zwei Klicks („ETB", dann ins
Feld). Und das Feld steht am Ende der Einträge (`JournalPanel` listet alt
nach neu), bei langem ETB also außer Sicht.

Was es gibt:

- `src/app/operations/[id]/JournalPanel.tsx`: ein `Stack` mit Fehler-Alert,
  Checkbox „Automatische ausblenden", der Eintragsliste und darunter dem
  `Textarea` (`aria-label="Neuer Eintrag"`, Strg+Enter sendet) mit dem Knopf
  „Eintrag hinzufügen".
- `src/map/SituationWorkspace.tsx` nach Ticket 01: `isDesktop` aus
  `useIsDesktop()`, `switchMainView(view)` kehrt bei `view === mainView`
  sofort zurück. Das ETB steht in `.etb-pane`, das heute als Ganzes scrollt
  (`overflow: auto`).
- Zwei `MainViewBar`-Instanzen (Footer am Smartphone, Seitenleiste am
  Desktop) teilen denselben `onSelect`.

## Plan

1. **Ref aufs Eingabefeld.** `JournalPanel` bekommt eine Prop
   `newEntryRef?: Ref<HTMLTextAreaElement>`, die an das `Textarea` geht.
   Beweis: Test in `JournalPanel.test.tsx`, dass der übergebene Ref auf das
   Feld „Neuer Eintrag" zeigt.
2. **Fokus nach Klick auf „ETB" am Desktop.** In `SituationWorkspace.tsx`
   eine eigene Behandlung für die Wahl von „ETB": ansichtswechsel wie bisher,
   und am Desktop (`isDesktop === true`) ein Fokuswunsch (Zähler-State), den
   ein Effekt nach dem Rendern einlöst, damit das Feld schon sichtbar ist.
   Das greift auch, wenn das ETB schon gezeigt wird. Beweis: Tests mit
   `stubMatchMedia(true)`: von „Lagekarte" auf „ETB" → Feld hat Fokus; Fokus
   wegnehmen, erneut „ETB" → Feld hat Fokus; von „Stärke" auf „ETB" → Fokus.
   Mit `stubMatchMedia(false)`: von „Lagekarte" auf „ETB" → Feld hat keinen
   Fokus (AC-11).
3. **Feld fest unten am Desktop.** `JournalPanel` trennt Kopf und Liste
   (scrollender Bereich, Klasse z. B. `journal-entries`) vom Eingabebereich
   (Klasse z. B. `journal-new-entry`). In `situation-workspace.css` ab 48 em:
   `.etb-pane` ist eine Flex-Spalte ohne eigenes Scrollen, die Liste
   `flex: 1; min-height: 0; overflow: auto`, der Eingabebereich
   `flex: none`. Unter 48 em bleibt `.etb-pane` der scrollende Behälter wie
   heute. Beweis: Test in `JournalPanel.test.tsx`, dass das Feld „Neuer
   Eintrag" und der Knopf nicht innerhalb des Listenbereichs liegen;
   Sichtprüfung über `run-einsatz` bei 1280 px mit ≥ 40 Einträgen (Feld
   sichtbar ohne Scrollen, Liste scrollt) und bei 360 px (unverändert).
4. `npm run check` grün.

## Not here

- Das Layout der Seitenleiste selbst: Ticket 01.
- Karten-Modi beim Wechsel: Ticket 03.
- Tastenkürzel für ETB (Non-goal der Lösung).
- Keine Änderung an der Reihenfolge der Einträge oder am automatischen
  Scrollen der Liste.
