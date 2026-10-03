---
criteria:  CRITERIA.md
closes:    AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11, AC-12, AC-14
advances:
after:     01-kartenpanel-leiste
status:    ready
attempts:  0
---

## Build
One ⋮ menu in the header, identical on desktop and phone, with Teilen,
Standard-Ausschnitt festlegen and Zurück zu Einsätze. "Standard-Ausschnitt
festlegen" leaves the map corner, which keeps only zoom and "Zum
Standard-Ausschnitt zurück".

## Done when
> **AC-5** The map corner holds only the zoom buttons and "Zum Standard-Ausschnitt zurück"; there are no panel buttons and no "Standard-Ausschnitt festlegen" anywhere on the map.

> **AC-6** "Zum Standard-Ausschnitt zurück" behaves as before this change: disabled while the Einsatz has no Standard-Ausschnitt, and on the phone hidden while a sheet is open.

> **AC-7** On desktop and phone the header carries one ⋮ menu with exactly these entries, in this order: Teilen, Standard-Ausschnitt festlegen, Zurück zu Einsätze. The desktop header has no separate "Teilen" button and no "← Einsätze" link.

> **AC-8** "Teilen" in the menu opens the "Ansichtslinks teilen" dialog; "Zurück zu Einsätze" leads to the list of Einsätze (`/operations`).

> **AC-9** "Standard-Ausschnitt festlegen" asks for confirmation with the text "Der aktuelle Kartenausschnitt wird zum Standard-Ausschnitt dieses Einsatzes."; confirming makes the map view currently shown the Einsatz's Standard-Ausschnitt; cancelling changes nothing.

> **AC-10** After a successful "Standard-Ausschnitt festlegen" the confirmation dialog closes and no further message appears; on failure the error shows in the still-open confirmation dialog.

> **AC-11** Phone: under ETB or Stärke, "Standard-Ausschnitt festlegen" in the menu is disabled; under Lagekarte it can be used.

> **AC-12** The read-only map views (Ansichtslink and Gerätelink) look and behave as before this change.

> **AC-14** Phone: under Lagekarte, "Standard-Ausschnitt festlegen" can be used while a sheet is open; it saves the centre and zoom of the whole map area, including the part under the sheet, and leaves the sheet open.

## Nudges
> Move `MapPanel` and `MAP_PANEL_LABEL` out of `MapControls.tsx` to the new row; `MapControls` keeps only "Zum Standard-Ausschnitt zurück".

> The current map view lives in `SituationMapView`, the menu in `LageansichtShell`: pass the "Festlegen" action from one to the other through `SituationWorkspace`, and keep `ConfirmationModal` for the confirmation.

> Leave `DeviceView` and `ReadOnlySituationMap` untouched.

## Context
- Header: `src/map/LageansichtShell.tsx`. Desktop header today: `BackLink`
  "Einsätze", the operation name, a "Teilen" button, the connection indicator,
  the status badge. Phone header: name, indicator, badge and a ⋮ `Menu`
  (`aria-label="Menü"`) with "Teilen" and "Zurück zu Einsätze" (a `Link` to
  `/operations`). "Teilen" opens the "Ansichtslinks teilen" modal
  (`ViewLinkPanel`). Tests: `src/map/LageansichtShell.test.tsx`.
- After ticket 01, `MapControls` (`src/map/MapControls.tsx`) holds
  "Standard-Ausschnitt festlegen" (with a `ConfirmationModal`, title
  "Standard-Ausschnitt festlegen", confirm "Festlegen" in blue, text "Der
  aktuelle Kartenausschnitt wird zum Standard-Ausschnitt dieses Einsatzes.")
  and "Zum Standard-Ausschnitt zurück" (disabled without a default view).
  `ConfirmationModal` (`src/app/ConfirmationModal.tsx`) already shows a
  failing action's error inside the open dialog and closes on success - which
  is AC-10; no notification is added.
- The view to save comes from `mapRef.current?.getView()` in
  `SituationMapView.saveDefaultView` (returns `MAP_LOADING` while the map has
  not loaded); `onSetDefault` is a prop of `SituationWorkspace`. The header is
  rendered by `SituationWorkspace` through `LageansichtShell`.
- On the phone the map is hidden under ETB/Stärke: `mapShown` from
  `useMainView` is false there and always true on desktop. That is the
  condition for AC-11.
- On the phone, `.map-controls__view` is hidden while a sheet is open
  (`[data-panel-open]` rule in `situation-workspace.css`) - that rule must keep
  hiding "Zurück" (AC-6). The saved view while a sheet is open is
  `getView()` of the whole map, unchanged (AC-14).
- Read-only views: `ViewLinkView.tsx`, `DeviceView.tsx` and
  `ReadOnlySituationMap.tsx` share none of `LageansichtShell`, `MapControls`,
  `MapPanelSwitch` or `situation-workspace.css`.
- Existing tests that use the moved controls:
  `SituationWorkspace.map-view.test.tsx` (clicks "Standard-Ausschnitt
  festlegen" by label), `MapControls.test.tsx` (confirmation cases),
  `SituationWorkspace.notifications.test.tsx`, `LageansichtShell.test.tsx`
  (Teilen button, back link) and `SituationWorkspace.test.tsx` ("renders the
  operation name and Teilen in the header", `getByText(/Teilen/)`).
- Both header groups (`data-testid="desktop-header"` and `"mobile-header"`)
  are always in the DOM; `visibleFrom`/`hiddenFrom` hide one by CSS, which
  jsdom does not apply. Tests therefore scope to a header with `within(...)`.

## Plan
1. **Red: the menu where the user acts.** In `LageansichtShell.test.tsx`,
   replace "offers a Teilen control…" and "shows the operation name, a back
   link…" with: on desktop and phone the header has exactly one "Menü" button,
   (scoped with `within(screen.getByTestId("desktop-header"))` and
   `"mobile-header"`; update the existing unscoped `getByRole("button",
   { name: "Menü" })` calls the same way), whose menu lists exactly Teilen, Standard-Ausschnitt festlegen, Zurück zu
   Einsätze in that order; the desktop header has no "Teilen" button and no
   "Einsätze" link outside the menu; Teilen opens "Ansichtslinks teilen";
   Zurück zu Einsätze links to `/operations` (AC-7, AC-8). In
   `SituationWorkspace.map-view.test.tsx`, change the default-view tests to go
   through the menu: confirm text shown, Festlegen saves `getView()`, Abbrechen
   saves nothing, a failing save shows its error in the open dialog and no
   notification appears, a success closes the dialog (AC-9, AC-10); phone: the
   entry is disabled under ETB and Stärke and enabled under Lagekarte (AC-11);
   phone with the Ebenen sheet open: Festlegen saves the whole map's view and
   the sheet is still open afterwards (AC-14). Add to the same file: the
   "Kartenknöpfe" group contains only "Zum Standard-Ausschnitt zurück", and no
   "Standard-Ausschnitt festlegen" button exists outside the menu (AC-5); keep
   the existing "disables the return-to-default button…" test and add one that
   "Zurück" is hidden on the phone while a sheet is open (AC-6 - assert only
   that the map view carries `data-panel-open` and "Zurück" sits in
   `.map-controls__view`, as "marks the Lagekarte while a map panel is open"
   does; the CSS rule itself stays unchanged and is checked by eye in step 6).
   In `SituationWorkspace.test.tsx` (570 lines; this ticket only removes code from it, which the standard allows) remove the Teilen
   assertion from "renders the operation name and Teilen in the header" and
   rename it accordingly; the shell tests cover Teilen. Tests that click the
   desktop "Teilen" button open Teilen through the scoped menu instead: the
   `askToDelete` helper in "deleting a view link from Teilen"
   (`LageansichtShell.test.tsx`) and "keeps an Ansichtslinks notification
   standing…" (`SituationWorkspace.notifications.test.tsx`). Run the files - red.
2. **Menu in the shell.** `LageansichtShell` builds the ⋮ `Menu` once as a
   JSX value (like `statusBadge` today) and renders it in both header groups,
   replacing the phone's existing menu; on desktop it sits rightmost in the
   right-hand group, after the status badge, as on the phone; the "Ansichtslinks teilen" modal and
   the confirmation dialog stay rendered once, outside the headers. New props for the default-view entry (e.g.
   `onSetDefaultView: () => Promise<ActionResult>` and
   `setDefaultViewDisabled: boolean`). The entry opens the
   `ConfirmationModal` (moved from `MapControls`, same title, text, label and
   blue colour). Remove the desktop "Teilen" button and `BackLink`. Proven by
   step 1's shell tests.
3. **Wire the action up.** `SituationWorkspace` owns the map handle: create
   the `useRef<SituationMapHandle>` there and pass it into `SituationMapView`
   (new prop replacing its internal `mapRef`), move `saveDefaultView` to
   `SituationWorkspace`, and pass it plus `setDefaultViewDisabled={!mapShown}`
   to `LageansichtShell`. Move `onSetDefault` from `SituationMapViewProps` to
   `SituationWorkspaceProps` (and out of `SituationMapView`'s destructuring).
   Export `MAP_LOADING` from `SituationMapView.tsx` (still used by `addImage`
   there) and import it in `SituationWorkspace`. Proven by step 1's workspace
   tests.
4. **Trim `MapControls` to "Zurück".** Remove "Standard-Ausschnitt festlegen",
   its modal and the `onSetDefault` prop; move the confirmation cases from
   `MapControls.test.tsx` to `LageansichtShell.test.tsx` (blue "Festlegen"
   button from "saves the default view only after confirming", pending lock,
   fallback on throw) so they keep their coverage. `wc -l
   src/map/LageansichtShell.test.tsx` stays under 500; if it would not,
   shorten its existing setup first (shared helpers, `it.each`). Proven by both test files.
5. **Read-only views (AC-12).** `ViewLinkView`, `DeviceView` and
   `ReadOnlySituationMap` import nothing this change touches. Confirm
   `git diff main --stat` lists none of `ViewLinkView.tsx`, `DeviceView.tsx`,
   `ReadOnlySituationMap.tsx` or their tests, and that their existing tests
   pass unchanged; record this check under `## Left standing` as how AC-12
   was proven.
6. **Look at it and check.** Start the app (`run-einsatz` skill); on desktop
   and at 360 px open the menu, use each entry, confirm Festlegen with a sheet
   open on the phone; check the header is not cut off at 360 px and at the
   narrowest desktop width (768 px). `npm run check` green.

Decided here: `SituationWorkspace` owns the `SituationMapHandle` ref, and
`LageansichtShell` owns the confirmation dialog for the default view.

## Not here
- The panel row and the removal of the panel buttons are ticket 01.
- The "← Einsätze" back links on the account page and the user admin page
  stay as they are (out of scope for the whole change).
- No success notification after Festlegen (ruled out in `CRITERIA.md`).

## Left standing
