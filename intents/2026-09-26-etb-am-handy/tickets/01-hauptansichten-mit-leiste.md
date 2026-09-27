---
solution:  02-SOLUTION.md
satisfies: AC-1, AC-2, AC-9, AC-10, AC-12, AC-13, AC-14
after:     
status:    done
attempts:  1
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

## Record

Command: `docker compose -f docker-compose.test.yml up -d && npm run check`
(`tsc --noEmit`, `biome check`, `vitest run`) — green: 99 test files, 668
tests, no type or lint errors.

Criterion → test:

- **AC-1** (bar, tap shows full-area main view) —
  `src/map/MainViewBar.test.tsx` "marks the active view and reports a
  selection"; `src/map/SituationWorkspace.test.tsx` "starts on the ETB on a
  phone"; browser check A (56 px bar, both items present).
- **AC-2** (map nowhere visible while ETB shown, ≤16 px margin) —
  "starts on the ETB on a phone" (map `hidden`/`display:none`, unreachable via
  `getByRole`); browser check A (map `getComputedStyle().display === "none"`,
  `boundingBox() === null`; `.etb-pane` 16 px inline padding).
- **AC-9** (in-progress ETB entry and map viewport survive a switch) —
  "keeps a started ETB entry when switching to the Lagekarte and back";
  "does not recreate the map when switching views" (fake adapter: `create`
  called once, `destroy` never).
- **AC-10** (map fills without grey edges after switching) — pinned
  structurally by the map staying mounted (previous test) plus the
  pre-existing `src/map/leaflet-adapter.resize.test.ts` (untouched,
  ResizeObserver → `invalidateSize`); confirmed live in browser check B
  (3/3 `.leaflet-tile-loaded`, no blank tiles).
- **AC-12** (72 px desktop rail, same items/order) — "starts on the Lagekarte
  on the desktop"; browser check C (rail width 71 px measured).
- **AC-13** (ETB ≤720 px, left-aligned on desktop) — CSS-only
  (`.etb-pane` `max-width: 720px`), pixel sizes not observable in jsdom per
  ticket's Context; browser check C (`.etb-pane` width exactly 720 px, left
  edge at x=72, flush against the rail).
- **AC-14** (mobile→ETB, desktop→Lagekarte before JS) — "carries
  data-main-view=\"default\" in the server-rendered markup" (`renderToString`);
  "starts on the ETB on a phone" / "starts on the Lagekarte on the desktop"
  (stubbed `matchMedia`); browser check D — a genuine
  `javaScriptEnabled: false` Playwright context confirmed the server markup
  resolves the correct pane per viewport via CSS alone, with zero JS
  execution.
- **Edge case** (main view survives a resize across 768 px) — "keeps the main
  view when the width crosses 768 px" (simulates a real `MediaQueryList`;
  fires a captured `change` listener if one was wrongly registered — proven
  to catch that regression by a temporary mutation test before this was
  recorded).
- **Stärke not yet existing** — `MainViewBar` renders exactly the two items
  Lagekarte/ETB; no third item, no dead code for a Stärke view.

Browser check (step 7, delegated to a subagent driving headless Chromium via
Playwright against a freshly seeded dev DB — see its full report for
screenshots/scripts under `/tmp/check-*.png`, `/tmp/verify*.mjs`): all of A–D
above passed, including a live `getComputedStyle`/`getBoundingClientRect`
re-verification of the display:none fix below.

Two fresh-context `critique` rounds were run (per the `implement` skill):

- **Round 1** found one blocker: the inactive pane was hidden with the native
  `hidden` attribute, which Mantine's own `.mantine-Group-root` class
  (`display:flex`) silently defeats in a real browser — the UA `[hidden]`
  rule loses to any author-origin rule regardless of specificity, so jsdom
  tests (which never load Mantine's real stylesheet) couldn't see the bug.
  Fixed by switching both panes to an inline `style={{ display: mainView ===
  … ? "none" : undefined }}`, which always wins over any class. Verified via
  a real headless-Chromium check with Mantine's stylesheet loaded (in the
  critique round itself) and again in the step-7 browser check.
  Also found two should-fix items, both fixed: `MainViewBar`'s `activeView`
  now accepts `"default"` and marks neither item current before the start
  view is known (was wrongly defaulting to "etb"); the resize-edge-case test
  was rewritten to simulate a real `MediaQueryList` and actually invoke a
  captured `change` listener, since firing a plain `resize` event on
  `window` could never have failed against the regression it claimed to
  pin. Two nits fixed: a stale test name referencing the removed
  "Einsatztagebuch tab"; an over-loosened regex in the Kartenzeichen-search
  test tightened back to the exact label now that the query is scoped to the
  search-results group.
- **Round 2** came back clean (no blockers, no should-fix). Its four nits
  were applied: a stale code comment describing the old `[hidden]` mechanism
  reworded for the inline-style approach; the two pre-hydration media
  queries rewritten as exact complements (`@media not all and (min-width:
  48em)` / `@media (min-width: 48em)`) instead of `max-width: 47.9375em` /
  `min-width: 48em`, which left a real (if narrow) gap around fractional
  viewport widths; an unused `matchMediaSpy` dropped from a test helper's
  return value; the workspace's and shell's own `"active" | "closed"`
  literals replaced with the existing `OperationStatus` type from
  `src/server/operations/operations.ts`.
  Round 2 also flagged the desktop rail's `flex: 1` bar items as maybe
  stretching to half the rail's height — checked directly against a
  browser-check screenshot (`/tmp/check-C-desktop-map.png`): both items sit
  compact and top-aligned as intended, not stretched. No code change needed;
  not a defect.

Left standing (tradeoffs raised by critique, not acted on — per
`CODING_STANDARDS.md` these are decisions for a person, not something to
resolve unilaterally in an unattended run):

- `SituationWorkspace` now renders `LageansichtShell` and owns the page
  shell/header props (five props it only passes through), so the bar can
  share `mainView` state with both panes without a context. Alternative:
  lift the state into a small client wrapper around shell+workspace, at the
  cost of `page.tsx`'s current flatness.
- `MainViewBar` is rendered twice (once per `AppShell.Footer`/`Navbar` slot,
  shown/hidden via Mantine's `hiddenFrom`/`visibleFrom`), so there are always
  two DOM copies; tests use `getAllByRole(...)[0]`. Alternative: one bar
  with its own positioning/repositioning code instead of relying on
  AppShell's slots.

Departure from the plan: none of substance — the plan's steps were followed
as written; the `hidden`→inline-`display:none` change (step 3) was a fix
found by review, not a planned departure.

Not run: a third critique round (stop condition — round 2 was clean, per the
`implement` skill's two-rounds-at-most rule).
