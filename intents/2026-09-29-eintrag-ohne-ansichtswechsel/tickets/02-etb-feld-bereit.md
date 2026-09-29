---
solution:  02-SOLUTION.md
satisfies: AC-2, AC-12, AC-11
after:     01-seitenleiste-am-desktop
status:    done
attempts:  1
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

## Record

**Criteria → tests**

- **AC-2** — `src/map/SituationWorkspace.test.tsx` › „the cursor in the ETB on the desktop" › „puts the cursor into Neuer Eintrag when ETB is chosen from the Lagekarte", „… from the Stärke", „puts the cursor back into Neuer Eintrag when ETB is chosen while the ETB is shown". The tests click in the sidebar's own bar (inside `main`). `src/app/operations/[id]/JournalPanel.test.tsx` „hands out the Neuer Eintrag field through newEntryRef" covers plan step 1.
- **AC-12** — `JournalPanel.test.tsx` „keeps Neuer Eintrag and its button outside the scrolling list" (field and button are not inside `.journal-entries`). Vitest loads no CSS, so the scrolling itself was checked in the browser (see Command).
- **AC-11** — `SituationWorkspace.test.tsx` „leaves the cursor where it is when ETB is chosen on a phone". The ticket-01 phone tests („starts on the ETB on a phone", „opens no map sheet at start on a phone", „switches and closes map panels via the controls and ✕ on a phone", „closing the sheet on a phone") stay green. The phone layout was checked in the browser.

The three AC-2 tests after the first and the phone test passed on their first run, because the counter implied them. Each was proven by mutation and went red: dropping `&& isDesktop` (phone test), requesting focus only when the view changes (already-shown test), and not requesting focus when coming from Stärke (Stärke test).

**Command**: `npm run check` (test Postgres container up): green, 116 files, 1087 tests. Browser checks via `run-einsatz` with ≥ 40 entries at 1280×800 and 360×740:
- Desktop: the field is at y 630–686 and the button at y 696–732, above the sidebar bar (y 744–800). Only `.journal-entries` scrolls under the mouse wheel; the field and page do not move.
- Desktop: the cursor is in the field after choosing ETB from Lagekarte, from Stärke, and again with the ETB already shown. After Strg+Enter the field keeps its place and focus.
- Phone: `.etb-pane` scrolls as a whole with the field at the end, and there is no focus after Lagekarte → ETB.

**Departures from the plan**

- The error alert and the „Automatische ausblenden" checkbox are not in the scrolling area. Only the entry list (`.journal-entries`) scrolls, so on the desktop a save error stays visible above the list, whatever the scroll position. On the phone nothing changes, because the whole pane scrolls there.
- `.etb-pane`'s inline `overflow: auto` moved into `situation-workspace.css`. An inline style would beat the desktop rule. `.strength-pane` is unchanged.
- The focus handling is `selectMainView` in `SituationWorkspace.tsx`, used as the shared `onSelect` of both bars. `selectMapPanel` still calls `switchMainView` directly.

**Left standing**

- Review round 1 asked for the journal layout rules to live next to `JournalPanel`. Round 2 then objected to that split, because it put the 48 em breakpoint in two files. Final state, as in the plan: all rules are in `situation-workspace.css` in one media block, and a comment at `JournalPanel`'s class names points there. A rename of the classes is still caught by no test except `.journal-entries` (CSS cannot be tested in Vitest).
- The final CSS was not re-checked in the browser. The second browser check ran on the intermediate version, which had its own stylesheet next to `JournalPanel`. The final CSS equals the version from the first browser check apart from the selector `.etb-pane > .journal-panel` → `.journal-panel`, with the same rules in the same media block.
- Browser finding, out of scope („Not here": automatic scrolling of the list): the list starts at the oldest entry and stays there after a new entry, so on the desktop you type below old entries and the new one is out of sight. It was the same before (the whole pane scrolled from the top). A candidate for a follow-up ticket.
- A React hydration-mismatch warning about inline `style` on Mantine inputs appeared in about half of the page loads (once with `caret-color: transparent`, which `src` does not contain). Most likely the headless browser touching the inputs before hydration; it was not compared against `main`. It was also seen once in ticket 01.
- Review observation, as AC-2 asks: tablets at 48 em or wider count as desktop, so each tap on „ETB" there also opens the on-screen keyboard.
- The ticket-01 Record item „the focused field slides down behind the sidebar bar after each entry" is fixed by AC-12 (checked in the browser).
