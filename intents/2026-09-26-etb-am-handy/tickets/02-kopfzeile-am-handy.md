---
solution:  02-SOLUTION.md
satisfies: AC-3, AC-5, AC-22
after:     01-hauptansichten-mit-leiste
status:    done
attempts:  1
---

## Build
A 40 px header on the phone with the name truncated, status and a ⋮ menu
(Teilen, Zurück zu Einsätze); the lost-connection banner becomes a header
symbol and the map error an overlay on the map, on both sizes.

## Done when
> **AC-3** Am Handy ist die Kopfzeile 40 px hoch. Zusammen mit der Leiste belegen Bedienelemente außerhalb der Hauptansicht 96 px.

> **AC-5** Die Kopfzeile am Handy zeigt den Einsatznamen in einer Zeile, gekürzt mit „…", dazu den Status und einen Knopf ⋮. Ein Tipp auf den Namen zeigt ihn vollständig in einem Popover. Das Menü ⋮ enthält „Teilen" (öffnet die bestehende Verwaltung der Ansichtslinks) und „Zurück zu Einsätze".

> **AC-22** Ist die Live-Verbindung getrennt, zeigt die Kopfzeile neben dem Status ein orangefarbenes Symbol mit dem zugänglichen Namen „Verbindung getrennt – wird automatisch wiederhergestellt"; ein Tipp zeigt diesen Text. Der bisherige Hinweisbalken über der Arbeitsfläche entfällt. Ein Kartenfehler (heute roter Balken, `mapError`) erscheint als schließbare Meldung über der Karte, ohne die Arbeitsfläche zu verkleinern. Beides gilt auf beiden Größen.

Edge case owned (from the solution):

> **Verbindung getrennt oder Kartenfehler:** siehe AC-22. Keiner der beiden Hinweise verschiebt die Hauptansicht; C-2 gilt auch dann.

## Context
After 01 `SituationWorkspace` renders `LageansichtShell`
(`src/app/operations/[id]/LageansichtShell.tsx`) and passes it the header
props. The shell's header today: `BackLink` („Einsätze"), `Title` with the
name, `ViewLinkShareButton` (a „Teilen" button that opens the „Ansichtslinks
teilen" modal with `ViewLinkPanel`), status `Badge` („aktiv"/„abgeschlossen"),
fixed 56 px. The workspace shows `connected === false` as an orange `Alert`
(role status, „Verbindung getrennt – wird automatisch wiederhergestellt.")
and `mapError` as a red dismissible `Alert` (role alert), both above the work
area, pushing it down.

## Plan
1. **Phone header.** `AppShell` header height `{ base: 40, sm: 56 }`. Below
   `sm`: name as a one-line truncated button that opens a `Popover` with the
   full name; status badge; ⋮ `Menu` with „Teilen" and „Zurück zu Einsätze"
   (link to `/operations`). From `sm`: header as today. Split
   `ViewLinkShareButton` so the modal can be opened from a menu item (e.g. an
   `opened/onClose`-controlled `ViewLinkShareModal` used by both the desktop
   button and the menu). Files: `LageansichtShell.tsx` (+ test),
   `ViewLinkShareButton.tsx` (+ test). Proof: tests "offers Teilen and Zurück
   zu Einsätze in the ⋮ menu on a phone" (menu item opens the modal with the
   links; link has `href="/operations"`), "shows the full name when the name
   is tapped", existing desktop tests green.
2. **Connection symbol.** Shell prop `connected`; when false an orange
   `ActionIcon` with `aria-label="Verbindung getrennt – wird automatisch
   wiederhergestellt"` next to the status, opening a popover with that text;
   on both sizes. The workspace passes `connected` and drops its orange
   banner. Proof: workspace test with `eventsHook` returning
   `{ connected: false }`: the button exists, no `role="status"` banner.
3. **Map error overlay.** `mapError` renders as a dismissible alert positioned
   absolutely over the map (not in the flow above the work area). Proof:
   existing map-error tests still find `role="alert"` and close it; new
   assertion that it is inside the map container.
4. **Browser check** at 360 × 640 with the long name: header 40 px, bar 56 px,
   96 px together, name truncated in one line, nothing clipped (AC-3, AC-5);
   disconnect the dev server to see the symbol, work area not shifted (AC-22).
5. `npm run check`.

## Not here
The bar itself (01). Hiding the bar for the keyboard (03). Everything on the
map except the map error overlay (04, 06).

## Record

Command: `docker compose -f docker-compose.test.yml up -d && npm run check`
(`tsc --noEmit`, `biome check`, `vitest run`) — green: 98 test files, 674
tests, no type or lint errors.

Criterion → test:

- **AC-3** (40 px phone header, 96 px total with the bar) — CSS-only
  (`HEADER_HEIGHT = { base: 40, sm: 56 }` on `AppShell`); pixel sizes aren't
  observable in jsdom per the ticket's Context, so pinned by browser check
  (below): header measured 40 px at 360×640, 56 px at 1280×800.
- **AC-5** (one-line truncated name, status, ⋮ menu with Teilen/Zurück zu
  Einsätze; tap-to-reveal popover) —
  `LageansichtShell.test.tsx`: "shows the operation name, a back link and the
  map content" (desktop), "shows the status on both header sizes", "exposes
  the operation name as a heading on the phone header too", "shows the full
  operation name in a popover when the truncated name is tapped", "opens
  Teilen from the ⋮ menu, showing the given view links", "offers a Zurück zu
  Einsätze link in the ⋮ menu" (checks `href="/operations"`), "offers a
  Teilen control that opens the given view links" (desktop, moved from the
  now-deleted `ViewLinkShareButton.test.tsx`, including the "not open before
  click" edge). Truncation itself (ellipsis, one line) is CSS
  (`truncate` + `minWidth:0` flex child) — pinned by browser check.
- **AC-22, connection symbol** — `LageansichtShell.test.tsx`: "shows no
  connection-lost symbol on either header size while connected", "shows an
  orange connection-lost symbol on both header sizes when disconnected, each
  with a popover explaining it" (exercises and closes each header's popover
  in turn, not just the first). `SituationWorkspace.test.tsx`: "shows a
  connection-lost symbol on both header sizes when the live stream is
  disconnected, without a banner above the work area" (also asserts
  `queryByRole("status")` is null, pinning the old banner's removal).
- **AC-22, map error overlay** — `SituationWorkspace.test.tsx`: the four
  pre-existing placement-error tests (surfaces `{error}`, surfaces a thrown
  fallback, clears on next success, ends placing mode) stayed green
  unchanged; new test "shows a placement error as an overlay inside the map
  container, not a banner above the work area" (`alert.closest('[data-view=
  "map"]')`) — this is a structural pin (element nesting), not a pixel one;
  "doesn't shrink the work area" itself follows from `position: absolute`
  removing the element from flow, which the browser check did not
  independently re-verify (see below).
- **Edge case** (neither hint shifts the main view) — same two tests above;
  `position: absolute` on both the connection popover (portalled) and the
  map-error box guarantees no reflow of siblings.

Browser check (`.claude/skills/run-einsatz`, headless Chromium via
Playwright, against the dev DB, operation named "Cyclassics 2026 –
Einsatzabschnitt 4 Nord an der langen Chaussee" then a second short-lived
"Round2-Recheck" op to re-verify after the round-2 fixes; both deleted
afterwards):
- 360×640: header `getBoundingClientRect().height` = 40; name
  `scrollWidth` (447) > `clientWidth` (232), confirming real truncation;
  "aktiv" badge and "Menü" button present; tapping the name opens a dialog
  containing the full name, wrapped and staying inside the viewport (this
  caught a real bug — see below); tapping "Menü" shows "Teilen" and "Zurück
  zu Einsätze"; "Teilen" opens "Ansichtslinks teilen" with the given links.
- 1280×800: header height = 56; desktop "Teilen" still opens the same modal.
- **Not exercised live**: the connection-lost icon (no way to force the SSE
  `EventSource` to drop from outside the page via the driver's command set)
  and the map error overlay (the advanced-symbol-form's "Bezeichnung" field
  enforces the same 200-char `maxLength` client-side that the server
  validates, so the invalid-composition path wasn't reachable through normal
  UI interaction in the time available). Both rest on unit tests plus the
  `position: absolute` argument above; flagged as open in both critique
  rounds too.

Two fresh-context `critique` rounds were run (per the `implement` skill):

- **Round 1** found no blockers. Three should-fix, all fixed: (1) tests were
  asserting "present in at least one header" instead of each header size
  separately — rewritten with `within(screen.getByTestId("desktop-header" |
  "mobile-header"))`, `data-testid` added to both header `Group`s; (2) the
  "Teilen" dialog existed twice (`ViewLinkShareButton`'s own state plus the
  shell's for the ⋮ menu) — first fixed by extracting a shared
  `ViewLinkShareModal(opened, onClose, …)` used by both; (3) the map-error
  overlay (initially anchored top-left) covered the search bar's results
  dropdown — moved to the bottom of the map. Three nits, all fixed: the
  name-popover test counted text-node occurrences instead of checking
  popover content (`role="dialog"` + `within`); the truncated name used a
  default `<Text>` (`<p>`), invalid inside the `<button>` — switched to
  `component="span"`; the mobile header had no heading role at all for the
  operation name (desktop has `<Title order={4}>`) — added a
  `VisuallyHidden` `<h4>`.
- **Round 2** found no blockers. One should-fix, fixed: the round-1 map-error
  reposition (bottom, spanning most of the width) now covered Leaflet's
  bottom-left zoom control (`leaflet-adapter.ts:245`,
  `zoomControl.setPosition("bottomleft")`) — narrowed to `left={56}
  right={72}` to clear both the zoom control and the bottom-right
  "return to default view" button. Four nits, three fixed: the separate
  `VisuallyHidden` heading plus the name button made screen readers announce
  the name twice — merged into one `<Title order={4}><Popover>…</Popover>
  </Title>`, the button is now the heading's only content; `ViewLinkShareModal`
  had shrunk to a single caller after round 1's other fix landed — inlined
  `<Modal>` + `<ViewLinkPanel>` directly into `LageansichtShell` and deleted
  the file; a test named "…each with a popover explaining it" only ever
  exercised the first (desktop) header's popover — rewritten to open, check,
  and close each header's popover in turn. One nit not applied: `Menu`'s
  explicit `withinPortal` prop is redundant since `Popover` (which `Menu`
  wraps) already defaults it to `true` — left as an explicit, self-documenting
  default rather than a functional fix; harmless either way, not worth a
  third round on its own.

Not run: a third critique round (round 2's only should-fix was applied and
verified in a fresh browser check; the one remaining nit is cosmetic and the
skill caps review at two rounds).

Left standing / not this ticket's to resolve:
- `LageansichtShell` now owns both the "Teilen" button/menu-item and the
  share dialog's open state directly (no more `ViewLinkShareButton`
  component) — this is more code in one file than the original plan's split
  suggested, but the plan's own reason for splitting (two callers needing
  independent control) stopped applying once round 1's fix made the shell
  the sole caller.
- The connection-lost icon and the map-error overlay's "doesn't shrink the
  work area" claim were not confirmed in a live browser (see above);
  everything else in AC-3/AC-5/AC-22 was.
