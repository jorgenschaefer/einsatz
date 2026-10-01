---
criteria:  CRITERIA.md
closes:    AC-8, AC-9, AC-10, AC-11, AC-12
advances:
after:     01-kml-ebene-aus-dem-leaflet-adapter
status:    ready
attempts:  0
---

## Build
Ein KML-Punkt ohne verwendbare Bild-URL erscheint als Kreis in der KML-Farbe
mit weißem Rand und einer Tippfläche von 32 px, statt als Leaflets
Standardmarker mit kaputtem Bild.

## Done when
> **AC-8** Ein KML-Punkt ohne verwendbare Bild-URL im `<IconStyle>` (verwendbar ist eine `http://`-, `https://`- oder `data:`-URL) erscheint in Führungs-, Ansichts- und Geräteansicht als farbiger Kreis von 14 px Durchmesser mit einem 2,5 px breiten weißen Rand außen herum (zusammen 19 px), wie im Specimen. Das gilt auch für Punkte mit relativer oder fehlender `<href>`.

> **AC-9** Hat der Punkt `<IconStyle><color>`, ist der Kreis in dieser Farbe, sonst in `#3388ff`, der Standardfarbe der KML-Linien. Der Kreis ist immer voll deckend; eine Deckkraft aus der KML-Farbe bleibt unbeachtet.

> **AC-10** Beim Anzeigen einer KML-Ebene mit solchen Punkten wird weder `marker-icon.png` noch `marker-shadow.png` angefragt, und keine durch die Punkte ausgelöste Anfrage endet mit einem Fehler.

> **AC-11** Die Tippfläche eines solchen Kreises ist mindestens 32 × 32 px groß und um den Punkt zentriert; Tippen oder Klicken öffnet wie bisher das Popup mit Name und Beschreibung.

> **AC-12** KML-Punkte mit verwendbarer Bild-URL im `<IconStyle>` sehen aus wie bisher.

## Nudges
> Der KML-Kreis braucht keine Bilddatei: kein `L.Icon.Default`, nichts unter `public/`; etwa ein `L.divIcon` mit 32-px-Box und dem Kreis in der Mitte.

## Context
- Nach Ticket 01 liegt die KML-Umwandlung in `src/map/kml-layer.ts`
  (`parseKml`, `kmlIconOptions`, `kmlPopupContent`), ihre Tests in
  `src/map/kml-layer.test.ts`. `parseKml` ruft in `pointToLayer`
  `kmlIconOptions(props)`. Liefert das `null`, entsteht heute
  `L.marker(latlng)` mit `L.Icon.Default`. Leaflet lädt dessen Bilder über
  einen relativen Pfad, der in der Lageansicht auf `/operations/marker-icon.png`
  zeigt und mit 500 endet.
- `kmlIconOptions` liefert nur für `icon`-Werte mit `http://`, `https://`
  oder `data:` Optionen. Das ist genau die „verwendbare Bild-URL“ aus AC-8.
  Relative oder fehlende `<href>` ergeben `null`.
- togeojson (`node_modules/@tmcw/togeojson/dist/togeojson.es.mjs`,
  `fixColor`) liefert `<IconStyle><color>` als `icon-color` (`#rrggbb`) und
  bei achtstelliger KML-Farbe (`aabbggrr`) zusätzlich `icon-opacity`. Es
  prüft nicht, ob die Zeichen hexadezimal sind: Aus `<color>` kann jeder
  sechs- oder dreistellige Text als `icon-color` kommen. Die Farbe ist
  Fremddaten und darf nicht ungeprüft in HTML oder CSS landen. Beispiel:
  `<color>ff4a9e2e</color>` ergibt `icon-color: "#2e9e4a"`,
  `icon-opacity: 1`.
- `#3388ff` ist Leaflets Standardfarbe für Pfade. Mit ihr zeichnet
  `kmlPathStyle` KML-Linien ohne eigenen Stil.
- `onEachFeature` bindet das Popup (`kmlPopupContent`) an jede Ebene, also
  auch an den neuen Marker. Daran ändert sich nichts.
- Führungs-, Ansichts- und Geräteansicht zeichnen KML über denselben Adapter
  (`setKmlOverlay` → `parseKml`). Eine Änderung in `parseKml` gilt in allen
  drei.
- Styles für Leaflet-Elemente stehen in `src/map/leaflet-adapter.css`, z. B.
  `.overlay-handle` für die Griffe eines Bild-Overlays.
- Vorbild für einen Test, der den Adapter wirklich in ein DOM zeichnet:
  `src/map/leaflet-adapter.tooltip.test.ts`
  (`leafletMapAdapterFactory.create(container, …)`).
- **Agreed design**: Specimen
  [kml-punkt-ohne-symbol](https://claude.ai/artifact/BbUoqbRZvFMrF35m4XjAma),
  Kopie in `../specimens/kml-punkt-ohne-symbol.html`. Farbige Fläche 14 px,
  2,5 px weißer Rand außen herum (zusammen 19 px), Farbe aus der KML oder `#3388ff`, voll deckend; die Mitte ist
  der Punkt. **Agreed; build to this, do not redesign.**

## Plan
1. **Red: der Kreis im gezeichneten DOM (AC-8, AC-10, AC-11), wo die
   Nutzerin hinsieht.** Neuer Test `src/map/leaflet-adapter.kml-point.test.ts`
   nach dem Muster des Tooltip-Tests: `setKmlOverlay` mit einer KML, deren
   Punkt kein `<IconStyle>` hat, und mit einer zweiten, deren `<href>`
   relativ ist (`pin.png`). Prüfen:
   - Im Container gibt es kein `img` mit `marker-icon` oder
     `marker-shadow` im `src` und überhaupt kein `img` für den Punkt.
   - Das Marker-Element (`.leaflet-marker-icon`) ist 32 × 32 px
     (`style.width`/`height`), mit `margin-left`/`margin-top` von -16 px,
     also zentriert, und enthält den Kreis.
   - Ein Klick auf das Marker-Element öffnet das Popup mit dem Namen
     (`.leaflet-popup-content` enthält ihn).
   Beweis: rot.
2. **Red: Farbe (AC-9) und unverändertes Bild-Symbol (AC-12).** In
   `src/map/kml-layer.test.ts`:
   - Ein Punkt mit `<IconStyle><color>ff4a9e2e</color></IconStyle>` → der
     Kreis hat `background-color` `#2e9e4a` (bzw. `rgb(46, 158, 74)`).
   - Ohne Farbe → `#3388ff`.
   - Mit `<color>004a9e2e</color>` (Alpha 0) → Kreis trotzdem voll deckend:
     kein `opacity` unter 1 am Kreis oder Marker.
   - Eine ungültige Farbe, in der KML escaped als
     `<color>zz"&gt;&lt;b</color>` (togeojson macht daraus
     `icon-color: '#zz"><b'`) → `#3388ff`, und es entsteht kein `b`-Element.
   - Der bestehende Test „renders a point's IconStyle icon href onto the
     marker“ bleibt unverändert grün (AC-12).
   Beweis: rot bis auf AC-12.
3. **Kreis-Marker bauen** in `src/map/kml-layer.ts`: Ist
   `kmlIconOptions(props)` `null`, `L.marker(latlng, { icon: kmlPointIcon(props) })`.
   `kmlPointIcon` (neu, exportiert, falls die Tests es brauchen) liefert ein
   `L.divIcon` mit `className: "kml-punkt"`, `iconSize: [32, 32]`,
   `iconAnchor: [16, 16]` und als `html` ein per
   `document.createElement("span")` gebautes Element, dessen
   `style.backgroundColor` die geprüfte Farbe ist. Die Farbe gilt nur, wenn
   sie auf `/^#([0-9a-f]{3}|[0-9a-f]{6})$/i` passt, sonst `#3388ff`.
   `icon-opacity` wird nicht gelesen. Beweis: Tests aus 1 und 2 grün.
4. **CSS** in `src/map/leaflet-adapter.css`. Mit eigenem `className` setzt
   Leaflet 1.9 die Klasse `.leaflet-div-icon` (weißer Kasten) nicht, die
   Box `.kml-punkt` ist also schon ohne Hintergrund. Der Kreis darin:
   `box-sizing: content-box`, `width`/`height` 14 px, `border: 2.5px solid #fff`
   (zusammen 19 px), `border-radius: 50%`, mittig in der 32-px-Box (z. B.
   Flexbox auf `.kml-punkt`). Die ganze Box bleibt anklickbar. Beweis: im
   Browser (Schritt 5), der Kreis misst dort 19 px außen.
5. **Im Browser prüfen** (Skill `run-einsatz`): eine KML-Datei mit drei
   Punkten einbinden: ohne `<IconStyle>`, mit Farbe, mit relativem `<href>`.
   In der Führungsansicht und über einen Ansichtslink prüfen:
   - Die Punkte sehen aus wie im Specimen.
   - Der Netzwerk-Tab zeigt keine Anfrage nach `marker-icon.png` und keine
     fehlgeschlagene Anfrage.
   - Am Handy (360 px) öffnet ein Tipp knapp neben den Kreis, innerhalb von
     16 px um die Mitte, das Popup.
   Die Geräteansicht nutzt denselben Adapter. Wenn sie sich ohne Gerät nicht
   prüfen lässt, unter `## Left standing` vermerken.
6. `npm run check` grün.

## Not here
- KML-Punkte mit verwendbarer Bild-URL, die nicht lädt – out of scope; sie
  behalten ihr `L.icon` wie bisher.
- Den Treffer der Adresssuche markieren (`adresssuche-markiert-den-treffer-nicht`)
  – out of scope.
- Eine Einsatz-ID, die keine UUID ist, ist Ticket 04, auch wenn sie im
  Backlog-Ticket `kml-punkte-ohne-markerbild` mitsteht.
- Leaflets `L.Icon.Default` wird nicht repariert und nicht konfiguriert;
  der Kreis braucht es nicht.

## Left standing
