---
criteria:  CRITERIA.md
closes:    AC-10, AC-11, AC-14
advances:
after:     01-suchtreffer-auf-der-karte
status:    done
attempts:  1
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
- Über den Plan hinaus: Escape schließt die Liste auch, wenn der Fokus auf
  einem Treffer oder auf „Suche löschen" liegt (der Handler sitzt an der `Box`,
  nicht nur am Feld), und gibt den Fokus dann ans Suchfeld zurück. Wer den
  Fokus per Tab aus Feld und Liste bewegt, schließt die Liste ebenfalls;
  `useClickOutside` reagiert nur auf Maus und Touch. Beides kam aus dem Review.
- Über den Plan hinaus: Die Liste startet geschlossen. Wird `SearchBar` mit
  stehendem Suchtext neu gezeigt (am Telefon nach ETB und zurück), öffnet sie
  sich erst bei Fokus, Klick oder Tippen und legt sich nicht ungefragt über die
  Karte.
- Vorhandene Tests angepasst: zwei in `SearchBar.test.tsx` und zwei in
  `SituationWorkspace.search.test.tsx` gingen davon aus, dass die Liste offen
  ist oder nach einer Wahl offen bleibt. Sie klicken jetzt erst ins Feld.
- Review-Nit nicht behoben: Wer einen Treffer per Tastatur (Enter) wählt,
  verliert den Fokus an den Seitenanfang, weil der fokussierte Knopf mit der
  Liste verschwindet. Den Fokus ins Feld zurückzugeben würde die Liste über
  `onFocus` wieder öffnen (gegen AC-10) und am Telefon die Bildschirmtastatur
  über der Karte halten. Ein anderes Fokusziel ist eine eigene Entscheidung.
- Plan Schritt 3 (Browser-Prüfung) habe ich nicht selbst gemacht; das hat der
  Review in zwei Runden übernommen: Führungsansicht auf 1280×800 und 390×844
  mit Touch, Ansicht auf Desktop und Telefon, Geräteansicht am Telefon. Nach
  der Wahl ist die Karte frei, ein Tap auf die Karte schließt die wieder
  geöffnete Liste, Text und Stecknadel bleiben stehen.
