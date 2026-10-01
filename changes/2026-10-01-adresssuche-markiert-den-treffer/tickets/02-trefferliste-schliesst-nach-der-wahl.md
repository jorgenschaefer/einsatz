---
criteria:  CRITERIA.md
closes:    AC-10, AC-11, AC-14
advances:
after:     01-suchtreffer-auf-der-karte
status:    ready
attempts:  0
---

## Build
Die Trefferliste der Kartensuche schließt sich nach der Wahl eines Treffers,
bei Escape und bei einem Tap oder Klick außerhalb, und öffnet sich wieder bei
Fokus oder Textänderung – der Suchtext bleibt dabei stehen.

## Done when
> **AC-10** Nach der Wahl eines Treffers – Adresse oder Einsatzobjekt – schließt sich die Trefferliste; der Suchtext bleibt im Feld stehen.

> **AC-11** Enthält das Suchfeld Text, öffnet die Trefferliste sich wieder, sobald das Feld den Fokus bekommt (Tap, Klick oder Tastatur), in das Feld getippt oder geklickt wird – auch wenn es den Fokus schon hat – oder der Suchtext geändert wird.

> **AC-14** Ein Tap oder Klick außerhalb von Suchfeld und Trefferliste sowie Escape schließen die Trefferliste; der Suchtext und die Markierung bleiben.

## Nudges
> Die Trefferliste in `SearchBar` schließen, ohne den Suchtext zu leeren.

## Context
- `src/map/SearchBar.tsx` zeigt die Liste heute, solange der Suchtext nicht leer
  ist (`open = query.trim().length > 0`); es gibt keinen eigenen Zustand für
  „Liste offen". Die Liste ist ein absolut positioniertes `Paper` unter dem
  `TextInput`, beides in einer `Box`.
- Nach `01-suchtreffer-auf-der-karte` ruft `SearchBar` für die Wahl
  `onChooseAddress(hit)` bzw. `onChooseObject(result)`; der Suchtreffer hängt am
  Suchtext (Leeren entfernt ihn), nicht an der offenen Liste.
- `@mantine/hooks` 9.6.3 ist installiert (`useClickOutside`).
- `SearchBar` ist in Führungsansicht, Ansicht und Geräteansicht dieselbe
  Komponente; ein Test an `SearchBar` deckt alle drei.

## Plan
1. **Tests für AC-10, AC-11, AC-14, rot**, in `src/map/SearchBar.test.tsx`
   (zustandsbehafteter Test-Wrapper, der `query` hält): Adresse wählen → Liste
   weg, Feld behält den Text; ebenso Einsatzobjekt; danach Fokus aufs Feld
   (Klick und Tab) → Liste wieder da; Text ändern → Liste da; Escape im Feld →
   Liste weg, Text bleibt; danach Klick ins (noch fokussierte) Feld → Liste
   wieder da; Klick auf ein Element außerhalb → Liste weg, Text bleibt; Klick
   in die Liste schließt sie nicht. Ein Test in
   `SituationWorkspace.search.test.tsx`: Escape lässt den Suchtreffer stehen
   (kein `clearSearchHit`). Beweis: die Tests schlagen fehl.
2. **Zustand „Liste offen" in `SearchBar`.** `useState`; offen bei `onFocus`,
   bei einem Klick oder Tap ins Feld (`onClick` – nach Escape behält das Feld
   den Fokus, ein Klick löst dann kein `onFocus` aus) und bei jeder
   Textänderung, zu nach einer Wahl, bei Escape (`onKeyDown` am Feld)
   und über `useClickOutside` am umgebenden `Box`. Angezeigt wird die Liste nur,
   wenn offen und Text vorhanden. `onQueryChange` wird beim Schließen nie
   aufgerufen. Beweis: Tests aus Schritt 1 grün.
3. **Im Browser prüfen** (Skill `run-einsatz`), Telefonbreite: nach der Wahl ist
   die Karte frei; Tap auf die Karte schließt eine wieder geöffnete Liste.
4. `npm run check` grün.

## Not here
- Suchtreffer und seine Regeln: `01-suchtreffer-auf-der-karte`.
- Zoomregel: `03-spruenge-zoomen-nie-heraus`.
- Keine Änderung an `useMapSearch` oder den Ansichten.

## Left standing
