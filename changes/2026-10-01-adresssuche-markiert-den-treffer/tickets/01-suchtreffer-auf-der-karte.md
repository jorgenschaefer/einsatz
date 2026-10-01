---
criteria:  CRITERIA.md
closes:    AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9
advances:
after:     04-situation-workspace-aufteilen
status:    done
attempts:  1
---

## Build
Nach der Wahl eines Adresstreffers in der Kartensuche steht eine orange,
unbeschriftete Stecknadel (der **Suchtreffer**) auf seiner Position – in
Führungsansicht, Ansicht und Geräteansicht – bis die Suche geleert oder ein
Einsatzobjekt gewählt wird.

## Done when
> **AC-1** Nach der Wahl eines Adresstreffers liegt eine Markierung genau auf der Position dieses Treffers – in der Führungsansicht, in der Ansicht (Ansichtslink) und in der Geräteansicht.

> **AC-2** Die Markierung sieht aus wie die Stecknadel aus Alternative 1 im Specimen: orange, ohne Beschriftung.

> **AC-3** Die Markierung bleibt stehen, während die Karte verschoben oder gezoomt wird, der Suchtext geändert, aber nicht geleert wird, ohne einen Treffer zu wählen, Panels geöffnet oder geschlossen werden, ein Kartenzeichen gesetzt wird, Änderungen anderer Nutzer per Live-Aktualisierung ankommen und auf dem Telefon zwischen Karte und ETB gewechselt wird.

> **AC-4** Die Wahl eines anderen Adresstreffers setzt die Markierung auf diesen Treffer; es gibt nie mehr als eine Markierung.

> **AC-5** Leeren der Suche – über „Suche löschen" (×) oder durch Löschen des Textes – entfernt die Markierung.

> **AC-6** Die Wahl eines Treffers unter „Einsatzobjekte" entfernt die Markierung.

> **AC-7** Die Markierung liegt über Kartenzeichen samt Bezeichnung, Bereichen samt Beschriftung, KML- und Bild-Overlays.

> **AC-8** Ein Tap auf die Markierung wirkt, als wäre sie nicht da: Ist ein Kartenzeichen zum Platzieren gewählt, wird es an der getippten Stelle gesetzt; ein Kartenzeichen unter der Markierung lässt sich antippen.

> **AC-9** Die Markierung sieht nur, wer gesucht hat: Andere Clients sehen sie nicht, und nach dem Neuladen der Seite ist sie weg.

## Nudges
> Die Markierung als neues Aufrufpaar am `MapAdapter` zeichnen (etwa `setSearchHit(position)` / `clearSearchHit()`), im Leaflet-Adapter als Marker mit `interactive: false` und hohem `zIndexOffset`.

> Den Zustand der Markierung bei der gemeinsamen Suche halten (`useMapSearch` / `SearchBar`), damit alle drei Ansichten ihn aus demselben Code bekommen, statt ihn je Ansicht nachzubauen.

## Context
- Die Kartensuche ist für alle drei Ansichten derselbe Code: `useMapSearch`
  (`src/map/useMapSearch.ts`, hält `query` und die Treffer) und `SearchBar`
  (`src/map/SearchBar.tsx`, Feld und Trefferliste). `SearchBar` ruft heute für
  beide Trefferarten nur `onJump(lat, lng)`; die Aufrufer reichen `jumpTo` aus
  `useMapFocus` durch: `SituationWorkspace.tsx` (Führungsansicht; nach
  `04-situation-workspace-aufteilen` nur noch Zusammensetzung) und
  `ReadOnlySituationMap.tsx` (Ansicht über `ViewLinkView`, Geräteansicht über
  `DeviceView`, Zeile ~144).
- `SituationMap.tsx` ist die einzige Stelle, die mit dem `MapAdapter`
  (`src/map/adapter.ts`) spricht; jede Kartenebene ist dort ein eigener
  `useEffect` über `ready` und ihre Props. Live-Aktualisierungen (SSE →
  `router.refresh()`) ändern nur die Props für Kartenzeichen, Bereiche und
  Overlays; die Komponenten bleiben gemountet. Auf dem Telefon blendet
  `SituationWorkspace` die Karte beim Wechsel zum ETB nur mit `display: none`
  aus (`className="map-view"`), sie bleibt gemountet.
- `src/map/leaflet-adapter.ts` spricht als einziger Ort mit Leaflet. Kartenzeichen
  sind `L.marker` im Marker-Pane (z 600, über dem Overlay-Pane mit Bereichen, KML
  und Bild-Overlays); die Griffe des Bild-Overlay-Editors nutzen
  `zIndexOffset: 2000`. Die Bezeichnungen der Kartenzeichen (Zeile ~295) und die
  Beschriftungen der Bereiche (Zeile ~58) sind dauerhafte Tooltips im
  Tooltip-Pane (z 650) – **über** dem Marker-Pane; kein `zIndexOffset` hebt einen
  Marker darüber. Für AC-7 zählen diese Beschriftungen zu „Kartenzeichen" und
  „Bereichen": Eine Bereichsbeschriftung mitten auf dem gesuchten Gebäude darf
  die Stecknadel nicht verdecken. Deshalb bekommt die Stecknadel ein eigenes
  Pane über dem Tooltip-Pane – eine bewusste Abweichung vom Nudge
  („hohem `zIndexOffset`"), unter `## Left standing` festzuhalten.
- Leaflets CSS setzt `pointer-events: none` auf `.leaflet-marker-icon` ohne
  `.leaflet-interactive` – ein Marker mit `interactive: false` lässt Taps also
  zur Karte (Platzieren über `onMapClick`) und zu darunterliegenden Markern
  durch. Ein eigenes Pane braucht zusätzlich selbst `pointer-events: none`.
- Die Fake-Adapter der Tests liegen vierfach vor und brauchen die neuen Methoden:
  `SituationWorkspace.fixtures.tsx`, `SituationMap.test.tsx`, `DeviceView.test.tsx`,
  `ViewLinkView.test.tsx`.
- Aussehen: Alternative 1 im Specimen
  (`../specimens/adresssuche-specimen.html`, Funktion `drawPin`): Stecknadel in
  `#e8590c` mit weißem Rand und weißem Punkt, Spitze genau auf der Position,
  etwa 26 × 40 px, ohne Text. **Agreed; build to this, do not redesign.**
- **Suchtreffer** (`SearchHit`) ist ein neuer Begriff; der Build trägt ihn in
  `UBIQUITOUS_LANGUAGE.md` ein: „der gewählte Adresstreffer der Kartensuche,
  als Stecknadel auf der Karte markiert, bis die Suche geleert oder ein
  Einsatzobjekt gewählt wird; nur lokal, nicht gespeichert".

## Plan
1. **Ansichts-Tests für AC-1, AC-4–AC-6, rot.** Neue Datei
   `src/map/SituationWorkspace.search.test.tsx`: Adresse suchen und wählen →
   `adapter.setSearchHit` mit der Trefferposition; zweiten Treffer wählen →
   zuletzt mit dessen Position; × und Leeren des Feldes → `clearSearchHit`;
   Einsatzobjekt wählen → `clearSearchHit`. In `DeviceView.test.tsx` und
   `ViewLinkView.test.tsx` je ein Test „Adresse wählen setzt den Suchtreffer".
   Beweis: die Tests schlagen fehl.
2. **Adapter-Schnittstelle.** `setSearchHit(position: LatLng): void` und
   `clearSearchHit(): void` in `src/map/adapter.ts` (mit Kommentar), als `vi.fn()`
   in den vier Fake-Adaptern. Beweis: `tsc --noEmit` grün.
3. **Leaflet-Umsetzung.** In `leaflet-adapter.ts` beim Aufbau ein eigenes Pane
   `searchHitPane` (`map.createPane`, `z-index` 660 – über Tooltip-Pane 650,
   unter Popups 700 –, `pointer-events: none`) und darin ein einziger
   `L.marker` mit `L.divIcon` (Inline-SVG wie im Specimen, Klasse `search-hit`,
   Anker an der Spitze), `interactive: false`, `keyboard: false`;
   `setSearchHit` verschiebt ihn oder legt ihn an, `clearSearchHit` entfernt
   ihn. Neue Testdatei `src/map/leaflet-adapter.search-hit.test.ts` (fällt unter
   das vorhandene Muster in `vitest.config.mts`): genau ein
   `.search-hit`-Element nach zwei Aufrufen, ohne Klasse `leaflet-interactive`,
   ohne Text; sein Pane hat einen höheren `z-index` als das Pane einer
   Kartenzeichen-Bezeichnung (per `setMarker` mit `label`) und einer
   Bereichsbeschriftung (per `setArea` mit `label`) und `pointer-events: none`;
   nach `clearSearchHit` keins mehr. Beweis: dieser Test grün.
4. **`SituationMap` zeichnet den Suchtreffer.** Neue Prop
   `searchHit?: LatLng | null`; eigener Effekt über `[ready, searchHit]` ruft
   `setSearchHit` bzw. `clearSearchHit`. Neue Testdatei
   `src/map/SituationMap.search-hit.test.tsx` (nicht in die 667 Zeilen von
   `SituationMap.test.tsx`): gesetzt, verschoben, entfernt; ein Rerender mit
   anderen `symbols`/`areas` ruft weder `clearSearchHit` noch erneut
   `setSearchHit` (AC-3, Live-Aktualisierung); neu gemountete Karte ohne Prop
   setzt keinen (AC-9). Beweis: Test grün.
5. **Zustand in der gemeinsamen Suche.** `useMapSearch` bekommt den Sprung als
   dritten Parameter (`jumpTo`) und liefert zusätzlich `searchHit`,
   `chooseAddress(hit)` (setzt Suchtreffer, springt) und `chooseObject(result)`
   (löscht Suchtreffer, springt); `setQuery` mit leerem/nur-Leerzeichen-Text
   löscht den Suchtreffer, anderer Text lässt ihn stehen. `SearchBar` ersetzt
   `onJump` durch `onChooseAddress(hit)` und `onChooseObject(result)`;
   `SearchBar.test.tsx` entsprechend anpassen. Die Regeln als neue Fälle in der
   vorhandenen `src/map/useMapSearch.test.ts`; deren drei Aufrufe
   `useMapSearch(symbols, geocode)` bekommen den dritten Parameter.
   Beweis: Hook-Tests grün.
6. **Verdrahten.** `SituationWorkspace.tsx` und `ReadOnlySituationMap.tsx`:
   `jumpTo` an `useMapSearch` geben (in `SituationWorkspace.tsx` steht
   `useMapFocus` dafür vor `useMapSearch`, heute ist es umgekehrt), `searchHit` an `SituationMap`,
   `chooseAddress`/`chooseObject` an `SearchBar`. In `SituationWorkspace.tsx`
   nur diese Verdrahtung, keine weitere Logik. Beweis: Tests aus Schritt 1 grün;
   zusätzlich in `SituationWorkspace.search.test.tsx`: nach dem Wechsel zum ETB
   und zurück, nach Öffnen eines Panels und nach dem Platzieren eines
   Kartenzeichens wurde `clearSearchHit` nicht aufgerufen (AC-3).
7. **Glossar.** Eintrag **Suchtreffer** (`SearchHit`) in
   `UBIQUITOUS_LANGUAGE.md`, alphabetisch einsortiert.
8. **Im Browser prüfen** (Skill `run-einsatz`), Desktop und Telefonbreite:
   Aussehen gegen das Specimen (AC-2); Stecknadel über einem Kartenzeichen
   samt Bezeichnung, einem Bereich samt Beschriftung, einem KML- und einem
   Bild-Overlay (AC-7); mit scharfgestelltem
   Kartenzeichen auf die Stecknadel tippen setzt es dort, ein Kartenzeichen
   unter der Stecknadel öffnet sich beim Antippen (AC-8); Verschieben und
   Zoomen lassen sie stehen (AC-3); zweiter Browser sieht keine, Neuladen
   entfernt sie (AC-9). Was kein Test beweist, kommt unter `## Left standing`.
9. `npm run check` grün.

Entscheidungen, die schwer zurückzunehmen sind: der Name `SearchHit` /
**Suchtreffer** und die Adapter-Methoden `setSearchHit`/`clearSearchHit`.

## Not here
- Dass die Trefferliste sich nach der Wahl schließt, wieder öffnet oder per
  Escape/Klick außerhalb zugeht: `02-trefferliste-schliesst-nach-der-wahl`.
  Hier bleibt die Liste offen wie bisher.
- Die Zoomregel beim Springen (nie herauszoomen): `03-spruenge-zoomen-nie-heraus`.
  Hier springt die Karte weiter wie bisher auf Zoom 16.
- Aus `Out of scope`: Ein gewähltes Einsatzobjekt auf der Karte hervorheben. Die Wahl eines Einsatzobjekts löscht hier nur
  den Suchtreffer.
- Aus `Out of scope`: Ein Kartenzeichen direkt aus dem Suchtreffer heraus setzen.
- Die Aufteilung von `SituationWorkspace.tsx` ist `04-situation-workspace-aufteilen`;
  dieser Ticket legt dort nur Verdrahtung dazu, keine Logik.

## Left standing
- Abweichung vom Nudge (wie im Ticket vorgesehen): Die Stecknadel steht nicht
  per hohem `zIndexOffset` im Marker-Pane, sondern in einem eigenen Pane
  `searchHitPane` (z-index 660, `pointer-events: none`), weil die
  Bezeichnungen der Kartenzeichen und die Beschriftungen der Bereiche im
  Tooltip-Pane (650) über jedem Marker-Pane liegen.
- Abweichung vom Plan, Schritt 3: Pane und Stecknadel stehen in einer eigenen
  Datei `src/map/search-hit-pin.ts` statt in `leaflet-adapter.ts` (456 Zeilen);
  der Adapter ruft sie nur auf. Getestet wird weiter über den Adapter in
  `leaflet-adapter.search-hit.test.ts`.
- Abweichung vom Plan, Schritt 2: Statt die zwei Methoden in vier (tatsächlich
  fünf, eine steckte inline in `SituationMap.test.tsx`) Fake-Adaptern
  nachzutragen, liegt der Fake jetzt einmal in `src/map/adapter.fixtures.ts`;
  er merkt sich den gezeichneten Suchtreffer (`drawn.searchHit`), damit die
  Ansichts-Tests den Zustand der Karte prüfen statt einzelner Aufrufe. Die
  vorhandenen Suchtests aus `SituationWorkspace.symbols.test.tsx` sind
  unverändert nach `SituationWorkspace.search.test.tsx` umgezogen.
- Über das Ticket hinaus: Liefert der Geocoder dieselbe Adresse zweimal
  (gleiche Bezeichnung und Position), steht sie nur einmal in der
  Trefferliste. Vorher warf React dabei eine Warnung wegen doppelter Keys (im
  Review mit Photon gesehen).
- Die Stecknadel ist samt weißem Rand 28 × 42 px groß, nicht 26 × 40 px. Das
  ist die Fläche, die der Pfad aus dem Specimen mit seinem Rand braucht.
- Kein automatischer Test beweist AC-2, AC-7 und AC-8 im echten Browser und
  das Verschieben und Zoomen aus AC-3. Die Unit-Tests prüfen nur die
  Pane-Reihenfolge, `pointer-events` und die Lage der Spitze. Der Review hat
  die laufende App in zwei Runden auf 1280×800 und auf 390×844 mit Touch
  gefahren:
  - AC-2: Abgleich mit `drawPin`.
  - AC-7: Stecknadel über Kartenzeichen samt Bezeichnung, über einem Kreis samt
    Beschriftung, über einem deckenden KML-Polygon und -Punkt und über einem
    Bild-Overlay. Das hat nur die erste Runde geprüft.
  - AC-8: Ein scharfgestellter KTW wird an der geklickten Stelle auf der
    Stecknadel gesetzt. Ein Kartenzeichen unter der Stecknadel öffnet sich per
    Klick und am Telefon per Tap. Platzieren durch die Stecknadel ist nur am
    Desktop geprüft, weil der Review am Telefon kein Kartenzeichen
    scharfstellen konnte.
  - AC-3: Ziehen, Zoom-Knöpfe und Pinch-Zoom.
  - AC-9: Ein zweiter Browser sieht keine Stecknadel; nach dem Neuladen ist sie
    weg.
- Review-Nit nicht behoben: Leeren auf `""`/`"   "` und Ändern des Textes sind
  sowohl in `useMapSearch.test.ts` als auch in
  `SituationWorkspace.search.test.tsx` getestet. Das bleibt so, weil AC-5 und
  AC-3 dort gepinnt sind, wo die Nutzerin oder der Nutzer handelt: im Suchfeld
  der Führungsansicht.
- Offener Punkt aus dem Review, kein Befund: Zweimal ist nach der Wahl einer
  Adresse am Telefon die Karte nicht oder erst verzögert gesprungen, während
  die Stecknadel richtig stand. Beim Wiederholen trat das nicht mehr auf. Den
  Sprung selbst ändert dieses Ticket nicht. Vermutlich hat die Messung die
  Pan-Animation erwischt, nachgewiesen ist das nicht.
