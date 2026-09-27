---
solution:  02-SOLUTION.md
satisfies: AC-1, AC-2, AC-9, AC-10, AC-12, AC-13, AC-14
after:     
status:    ready
attempts:  0
---

## Build
The Führungsansicht shows exactly one main view at a time – Lagekarte or ETB –
switched by a bar at the bottom on the phone (below 768 px) and on the left on
the desktop. Both views stay mounted.

## Done when
> **AC-1** Am Handy steht unten eine 56 px hohe Leiste mit den Punkten Lagekarte, ETB und (sobald es sie gibt) Stärke. Ein Tipp zeigt die gewählte Hauptansicht über die ganze Fläche zwischen Kopfzeile und Leiste.

> **AC-2** Während am Handy das ETB oder die Stärke zu sehen ist, ist die Lagekarte nirgends sichtbar, und deren Inhalt nimmt die volle Breite ein, abzüglich höchstens 16 px Rand je Seite.

> **AC-9** Beim Wechsel zwischen Hauptansichten bleiben ein angefangener ETB-Eintrag (und ein angefangenes Stärke-Formular) und der Kartenausschnitt erhalten.

> **AC-10** Nach dem Wechsel zur Lagekarte füllt die Karte die Fläche ohne graue, nicht geladene Ränder.

> **AC-12** Am Desktop steht die Leiste links, 72 px breit, mit denselben Punkten in derselben Reihenfolge. Die Kopfzeile bleibt bis auf AC-22 wie heute.

> **AC-13** Am Desktop wird das ETB auf höchstens 720 px Breite begrenzt und links ausgerichtet.

> **AC-14** Beim Öffnen der Führungsansicht ist am Handy das ETB die Hauptansicht, am Desktop die Lagekarte, schon bevor JavaScript geladen ist.

Edge cases owned (from the solution):

> **Fenster wird über 768 px hinweg verbreitert oder verschmälert** (Tablet oder großes Handy drehen): Die Hauptansicht bleibt, auch wenn sie noch nie per Tipp gewählt wurde (sie ist seit dem ersten Rendern festgelegt). Ein offenes Panel bleibt; nur Ort der Leiste und Form des Panels wechseln. Ein Modus auf der Karte läuft weiter.

This slice owns the first sentence of that edge case (the main view stays);
the panel part belongs to 06, the map-mode part to 04.

> **Stärke gibt es noch nicht:** Die Leiste hat zwei Punkte.

## Context
Today `src/app/operations/[id]/page.tsx` renders `LageansichtShell` (Mantine
`AppShell`, 56 px header with back link, name, `ViewLinkShareButton`, status)
around `SituationWorkspace` (`src/map/SituationWorkspace.tsx`, ~900 lines). The
workspace holds all state (SSE `connected`, `useMapMode`, tabs) and lays out the
map (`SituationMap`) next to a 360 px sidebar with four tabs (Einsatztagebuch,
Kartenzeichen, Bereiche, Ebenen), `keepMounted={false}` – so switching tabs
unmounts `JournalPanel` and loses its `draft` state. The sidebar has a collapse
button („Seitenleiste ein-/ausklappen").

Decided here, expensive to reverse: **the workspace renders the shell.** The bar
lives in the AppShell (`AppShell.Footer` on the phone, `AppShell.Navbar` on the
desktop) but needs the workspace's main-view state, and 02 needs `connected` in
the header. `page.tsx` therefore passes the header props (name, status, view
links and their actions) into `SituationWorkspace`, which renders
`LageansichtShell` around its content and hands it the bar.

Transitional state until 06: on the Lagekarte view the three remaining tabs
(Kartenzeichen, Bereiche, Ebenen) stay a right-hand sidebar exactly as today
(open by default, collapsible). On a phone it covers the map until collapsed;
06 replaces it with map controls.

Breakpoint: Mantine `sm` = 48em = 768 px (`visibleFrom`/`hiddenFrom`,
`matchMedia("(min-width: 48em)")`). Leaflet re-measures on container resize
through the existing `ResizeObserver` in `leaflet-adapter.ts` (pinned in
`leaflet-adapter.resize.test.ts`), which covers AC-10 when the hidden map
becomes visible again. Tests run in jsdom; `src/test/setup.ts` stubs
`matchMedia` with `matches: false` – override per test where the desktop is
needed. Pixel sizes cannot be observed in jsdom: they are checked in a browser.

## Plan
1. **The workspace renders the shell.** `LageansichtShell` gains a
   `navigation` prop (the bar, rendered in `AppShell.Footer` below `sm` and in
   a 72 px `AppShell.Navbar` from `sm`); `SituationWorkspace` gains the header
   props and renders `<LageansichtShell … navigation={…}>` around its content;
   `page.tsx` stops rendering the shell itself. Files:
   `src/app/operations/[id]/LageansichtShell.tsx` (+ `.test.tsx`),
   `src/map/SituationWorkspace.tsx` (+ `.test.tsx`),
   `src/app/operations/[id]/page.tsx`. Proof: existing shell tests green; new
   workspace test "renders the operation name and Teilen in the header".
2. **Main-view bar.** New `src/map/MainViewBar.tsx` (+ `.test.tsx`): items
   Lagekarte and ETB (label + icon, `aria-current="page"` on the active one),
   `onSelect(view)`. Proof: test "marks the active view and reports a
   selection".
3. **One main view at a time, both mounted.** Workspace state
   `mainView: "default" | "map" | "etb"`; the ETB and the map are rendered in
   sibling containers, the inactive one `hidden`. The ETB tab leaves the
   sidebar; the sidebar keeps Kartenzeichen, Bereiche, Ebenen and sits only in
   the map view. Proof (RED first): "keeps a started ETB entry when switching
   to the Lagekarte and back" (type into „Neuer Eintrag", switch, switch back,
   value still there) and "does not recreate the map when switching views"
   (fake adapter `destroy` not called, `create` called once) – AC-9.
4. **Start view.** Before hydration `mainView` is `"default"`, exposed as
   `data-main-view="default"` on the workspace root; CSS in
   `src/map/situation-workspace.css` shows the ETB below 48em and the map from
   48em for that value only. A mount effect reads
   `matchMedia("(min-width: 48em)")` once and sets `"map"` or `"etb"`; there is
   no listener, so a later width change keeps the view. Proof: tests "starts on
   the ETB on a phone" and "starts on the Lagekarte on the desktop" (stubbed
   `matchMedia`), "keeps the main view when the width crosses 768 px" (fire a
   change on the stubbed query), and a `renderToString` test that the server
   markup carries `data-main-view="default"`.
5. **ETB width.** The ETB container has 16 px side padding below `sm`; from
   `sm` it is `max-width: 720px`, left aligned. Proof: browser check (step 7).
6. **Adapt existing tests.** `openTab` in `SituationWorkspace.test.tsx`
   switches to the Lagekarte first; the „lays the four sidebar tabs out in a
   2x2 grid" test becomes a test of the three map tabs; the ETB tests select
   the ETB view. Proof: `npm test` green.
7. **Browser check** (dev server, Chrome device toolbar, operation named
   „Cyclassics 2026 – Einsatzabschnitt 4 Nord"): at 360 × 640 the bar is
   56 px high at the bottom and the ETB fills the width minus ≤ 16 px per side
   with no map visible (AC-1, AC-2); switching to the Lagekarte shows the map
   without grey edges (AC-10); at 1280 × 800 the bar is a 72 px rail on the
   left and the ETB is ≤ 720 px and left aligned (AC-12, AC-13); with
   JavaScript disabled the phone shows the ETB and the desktop the map
   (AC-14). Record the result in `## Record`.
8. `npm run check`.

## Not here
Header changes on the phone, connection symbol, map error as overlay (02).
Hiding the bar for the keyboard (03). Mode band and cancelling a mode on switch
(04). ETB counter on the bar (05). Map controls, sheet/right panel, zoom, search
width, removal of the transitional sidebar, the global no-horizontal-scroll and
all-functions checks (06).

Non-goals from the solution: showing Karte and ETB at the same time on the
desktop; remembering the chosen main view across a reload.
