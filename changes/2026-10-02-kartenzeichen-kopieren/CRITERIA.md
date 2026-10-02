# Criteria: Copy a Kartenzeichen, add Notunterkunft to the Schnellauswahl

## Problem
During an incident, the people placing Kartenzeichen sometimes need a kind of
Taktisches Zeichen that the fixed Schnellauswahl does not offer, and that kind
then gets placed several times. Each placement today means putting the same
DV-102 composition together again in several editor steps, just like the first
time, and that costs time while the situation is moving. What should be true
instead: once a kind of Zeichen has been composed, placing another one of it in
this Einsatz is as fast as placing an entry from the fixed Schnellauswahl. The
same holds in later Einsätze for kinds that are needed regularly, like
Notunterkunft. Kinds that only one Einsatz needed, like Bus, don't make it
slower to find the right Zeichen in other Einsätze.

Instance: at the KMFE Schleswiger Straße, Notunterkunft and Bus were each placed
several times, and each placement meant composing them again in the editor
("Erweitert …", `AdvancedSymbolForm`). The cost was mainly time. From general
experience, Notunterkunft is needed regularly, while Bus was specific to that
incident.

## Acceptance criteria
- **AC-1** Every row in the Kartenzeichen list of the Kartenzeichen panel has a "Kopieren" button right next to the pen (edit) button, styled like the pen (a small, subtle gray icon button). Its accessible name is "‹name shown in the row› kopieren".
- **AC-2** Tapping "Kopieren" starts placement: the "Kartenzeichen platzieren" band with "Abbrechen" appears. On a phone, the panel sheet closes, just as it does when arming a Schnellauswahl entry.
- **AC-3** After "Kopieren", the next tap on the map places a new Kartenzeichen at the tapped point. It has the same DV-102 composition as the copied one (all axes: Grundzeichen, Organisation, Fachaufgabe, Einheit, Verwaltungsstufe, Funktion, Symbol), no Bezeichnung and no Gerätelink, and its position is set manually. The placement mode ends after that one placement.
- **AC-4** Copying a live Kartenzeichen (one with a reporting Gerätelink) also produces a manually positioned Kartenzeichen without a Gerätelink.
- **AC-5** The copied Kartenzeichen stays unchanged: position, Bezeichnung, composition and Gerätelink.
- **AC-6** "Abbrechen" after "Kopieren" places nothing.
- **AC-7** Other users viewing the same Einsatz see the copy appear live, like any other newly placed Kartenzeichen.
- **AC-8** The Schnellauswahl has a new last entry, "Notunterkunft": Grundzeichen ortsfeste Stelle, Fachaufgabe Unterbringung, Organisation Hilfsorganisationen, no Symbol. It is armed and placed like the other entries.
- **AC-9** At 360 px viewport width, a Kartenzeichen row's name is cut off with "…", the pen and "Kopieren" buttons stay fully visible, and nothing scrolls horizontally.
- **AC-10** The rows in the Bereiche list are unchanged: they have no "Kopieren" button.
- **AC-11** Copying or placing a Kartenzeichen adds nothing to the Schnellauswahl: in every Einsatz it shows exactly the fixed entries from the code, and nothing that was placed or copied in any Einsatz.

## Agreed design
A "Kopieren" icon button next to the pen on each row of the Kartenzeichen list
arms placement with that row's composition minus its Bezeichnung, using the same
mode "Erweitert …" already uses. Kinds needed regularly across Einsätze go into
the fixed Schnellauswahl in code (`QUICK_SELECT`) with a release; Notunterkunft
is the first. No specimen: the only visual change is a second icon in the style
of the existing one.

## Nudges
- Copying arms the existing placement mode for custom compositions (`armCustom`, as `armAdvanced` in `src/map/useSymbolPlacement.ts` does). No new map mode.
- Add the copy button to `PanelRow` (`src/map/PanelRow.tsx`) as an optional action, so the Bereiche list, which also uses `PanelRow`, stays unchanged.
- Delete `changes/backlog/eigene-vorlagen-fuer-taktische-zeichen.md`; this change replaces it.

## Out of scope
- Copying Bereiche.
- Vorlagen or Schnellauswahl entries maintained by users or admins in the app.
- Prepared, named units that are known before they are deployed (parked in `changes/backlog/vorbereitete-einheiten.md`).
- Reordering the Kartenzeichen list (parked in `changes/backlog/reihenfolge-der-kartenzeichen-liste.md`).

## Ruled out
- **Vorlagen with a scope ("this Einsatz only" / "all Einsätze")** - L effort plus a new table, CRUD UI and SSE events for what a copy button does in two taps.
- **Kinds derived from use (Kartenzeichen already placed, or used across several Einsätze, appear automatically in the Schnellauswahl)** - fills the bar in busy Einsätze, and derived buttons have no name.
- **An admin-maintained global Schnellauswahl, or marking a placed Kartenzeichen as "for all Einsätze"** - a table and admin UI are not worth it while kinds needed regularly are rare and can be added in code.
- **Copy from the Kartenzeichen detail dialog instead of the row** - two extra taps; the row button matches the Schnellauswahl's tap-then-map.
- **Keeping the Bezeichnung on the copy** - invites two Kartenzeichen with the same name, e.g. a copied Funkrufname that looks like a second identical unit; the Schnellauswahl places without one too.
