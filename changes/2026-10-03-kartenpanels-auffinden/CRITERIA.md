# Criteria: Kartenpanels und Standard-Ausschnitt dort, wo man sucht

## Problem
Someone in the Lageansicht wants to work on the map's content. They go to the
bar where they pick what the sidebar shows and select "Lagekarte", expecting
Kartenzeichen, Bereiche and Ebenen to be reachable from there. Nothing there
leads to those panels, and at first they don't find a way in: the way in is a
column of buttons in the map's bottom-right corner (`src/map/MapControls.tsx`),
next to the buttons for interacting with the map directly. In the same column,
"Standard-Ausschnitt festlegen" sits directly above "Zum Standard-Ausschnitt
zurück", and the two look alike (`IconHomeEdit` / `IconHome`). Someone who wants
to return to the Standard-Ausschnitt hits "festlegen" instead and is confused by
the confirmation asking to change a setting of the Einsatz.

What should be true instead: someone who wants to work on Kartenzeichen,
Bereiche or Ebenen finds how to do it where they look first, and someone who
wants to interact with the map directly does not end up changing an Einsatz
setting by mistake.

Constraint chosen by the user: the map corner keeps only the buttons for
interacting with the map directly - zoom and returning to the
Standard-Ausschnitt.

Instances (both reported by the user, October 2026, desktop):
- To add a KML link, the user clicked "Lagekarte" in the sidebar bar, saw the
  Kartenzeichen panel and found no way to switch to Ebenen.
- Wanting to return to the Standard-Ausschnitt, the user clicked "Standard-
  Ausschnitt festlegen" and was confused by the confirmation dialog.

## Acceptance criteria
- **AC-1** Desktop: while Lagekarte is the active view, a row Kartenzeichen | Bereiche | Ebenen sits directly above the sidebar's bar; clicking an entry shows that panel in the sidebar and marks the entry as selected.
- **AC-2** Desktop: under Lagekarte exactly one panel is always shown and marked in the row; on first opening Lagekarte it is Kartenzeichen.
- **AC-3** Phone: while Lagekarte is the active view, the same row sits directly above the bottom bar; tapping an entry opens that panel as a sheet over the map and marks the entry; tapping the marked entry again, or the sheet's close button, closes the sheet; with the sheet closed no entry is marked. While the on-screen keyboard is open, the row is hidden together with the bottom bar.
- **AC-4** The row is not shown under ETB or Stärke, on desktop or phone.
- **AC-5** The map corner holds only the zoom buttons and "Zum Standard-Ausschnitt zurück"; there are no panel buttons and no "Standard-Ausschnitt festlegen" anywhere on the map.
- **AC-6** "Zum Standard-Ausschnitt zurück" behaves as before this change: disabled while the Einsatz has no Standard-Ausschnitt, and on the phone hidden while a sheet is open.
- **AC-7** On desktop and phone the header carries one ⋮ menu with exactly these entries, in this order: Teilen, Standard-Ausschnitt festlegen, Zurück zu Einsätze. The desktop header has no separate "Teilen" button and no "← Einsätze" link.
- **AC-8** "Teilen" in the menu opens the "Ansichtslinks teilen" dialog; "Zurück zu Einsätze" leads to the list of Einsätze (`/operations`).
- **AC-9** "Standard-Ausschnitt festlegen" asks for confirmation with the text "Der aktuelle Kartenausschnitt wird zum Standard-Ausschnitt dieses Einsatzes."; confirming makes the map view currently shown the Einsatz's Standard-Ausschnitt; cancelling changes nothing.
- **AC-10** After a successful "Standard-Ausschnitt festlegen" the confirmation dialog closes and no further message appears; on failure the error shows in the still-open confirmation dialog.
- **AC-11** Phone: under ETB or Stärke, "Standard-Ausschnitt festlegen" in the menu is disabled; under Lagekarte it can be used.
- **AC-12** The read-only map views (Ansichtslink and Gerätelink) look and behave as before this change.
- **AC-13** Phone: a sheet open when switching to ETB or Stärke is open again, with its entry marked, on returning to Lagekarte.
- **AC-14** Phone: under Lagekarte, "Standard-Ausschnitt festlegen" can be used while a sheet is open; it saves the centre and zoom of the whole map area, including the part under the sheet, and leaves the sheet open.

## Agreed design
A row with the three map panels appears directly above the main view bar
whenever Lagekarte is active - in the desktop sidebar and above the phone's
bottom bar alike. Rare and Einsatz-wide actions move into one ⋮ menu in the
header that is identical on desktop and phone.

Specimen: https://claude.ai/artifact/9Ssmr7joXVdhRPNz64ZmqE, copy in
`specimens/kartenpanels.html` beside this file (the header menu is not drawn
there).

**Agreed; build to this, do not redesign.**

## Nudges
- Build the panel row as one component used in both places (desktop sidebar, above the phone bar), and keep the panel logic in `useMainView` (`selectMapPanel`: on desktop a panel is always open, on the phone the entry toggles).
- Move `MapPanel` and `MAP_PANEL_LABEL` out of `MapControls.tsx` to the new row; `MapControls` keeps only "Zum Standard-Ausschnitt zurück".
- The current map view lives in `SituationMapView`, the menu in `LageansichtShell`: pass the "Festlegen" action from one to the other through `SituationWorkspace`, and keep `ConfirmationModal` for the confirmation.
- Leave `DeviceView` and `ReadOnlySituationMap` untouched.

## Out of scope
- The "← Einsätze" back links on the account page and the user admin page.
- The contents of the Kartenzeichen, Bereiche and Ebenen panels.

## Ruled out
- **Tabs at the top of the map panel** - puts the tabs in different places on desktop (top of the panel) and phone (bottom of the map).
- **Kartenzeichen, Bereiche and Ebenen as entries of the main view bar** - loses the plain Lagekarte entry and crowds the phone bar with five items.
- **Labelled panel buttons elsewhere on the map** - the map corner is reserved for interacting with the map directly, and people look in the sidebar bar, not on the map.
- **"Standard-Ausschnitt festlegen" in the Ebenen panel** - the user chose the header menu, with the Einsatz-wide actions.
- **A context menu or long press on the map or on "Zurück"** - keeps the action on the map and is undiscoverable on a phone.
- **Phone: one panel always marked, with the sheet closable independently** - the user kept the toggle: with the sheet closed, no entry is marked.
- **A notification "Standard-Ausschnitt festgelegt" after "Festlegen"** - the user dropped it; the closing dialog is the feedback.
- **"Festlegen" usable on the phone under ETB or Stärke** - would save a map view nobody is looking at.
- **Phone: "Festlegen" disabled while a sheet is open, or closing the sheet before confirming** - the user chose to allow it and save the whole map area.
