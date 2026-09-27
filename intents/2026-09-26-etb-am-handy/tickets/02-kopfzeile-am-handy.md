---
solution:  02-SOLUTION.md
satisfies: AC-3, AC-5, AC-22
after:     01-hauptansichten-mit-leiste
status:    ready
attempts:  0
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
