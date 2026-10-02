---
criteria:  CRITERIA.md
closes:    AC-13, AC-14
advances:
after:
status:    done
attempts:  1
---

## Build
Ein neu hochgeladenes Bild-Overlay startet mittig auf dem Kartenausschnitt,
den der Hochladende sieht, und so groß, dass es höchstens die halbe Breite
und die halbe Höhe dieses Ausschnitts einnimmt – statt auf dem
Standard-Ausschnitt des Einsatzes mit fester Breite von 1000 m.

## Done when
> **AC-13** Ein neu hochgeladenes Bild-Overlay liegt bei allen Clients mittig auf dem Kartenausschnitt, den der Hochladende beim Hochladen sieht – der ganzen Kartenfläche, auch unter einem offenen Blatt –, unabhängig vom Standard-Ausschnitt des Einsatzes.

> **AC-14** Ein neu hochgeladenes Bild-Overlay ist höchstens halb so breit und höchstens halb so hoch wie dieser Ausschnitt, und eine der beiden Grenzen ist erreicht – gemessen in Metern am Boden, auf 5 % genau.

## Nudges
> AC-13/14: Der Client gibt Mitte und Ausdehnung des Ausschnitts in Metern an `addImageOverlayAction`; der Server rechnet mit dem Seitenverhältnis des Bildes `scaleM` aus, in `defaultImagePlacement`, das den Standard-Ausschnitt dann nicht mehr braucht.

## Context
- **Heute:** `addImageOverlayAction(operationId, file)`
  (`src/app/operations/[id]/image-overlay-actions.ts`) legt das Overlay mit
  `defaultImagePlacement(operation.defaultView ?? null)` an
  (`src/map/image-overlay.ts`): Mitte = Standard-Ausschnitt oder
  `FALLBACK_VIEW` (Mitte Deutschlands, `src/map/view.ts`), `scaleM` = 1000.
  Der Kommentar von `defaultImagePlacement` verspricht „mittig auf dem
  aktuellen Kartenausschnitt“.
- **Platzierung:** `scaleM` ist die Breite des Bildes in Metern; die Höhe ist
  `scaleM / aspect` mit `aspect = widthPx / heightPx` (siehe
  `imageOverlayCorners` in `src/map/image-overlay.ts`). `prepareUpload` liefert
  `width` und `height` in Pixeln.
- **Verdrahtung:** `src/app/operations/[id]/page.tsx:215` übergibt
  `onAddImage={addImageOverlayAction.bind(null, operation.id)}` an
  `SituationWorkspace`; dieser reicht `onAddImage` über `LayersPanel` an
  `ImageOverlayPanel`. `SituationWorkspace` hält `mapRef`
  (`SituationMapHandle`, heute nur `getView()` = Mitte und Zoom).
- **Adapter:** `src/map/adapter.ts` (Schnittstelle), `src/map/leaflet-adapter.ts`
  (`currentView`, Zeile ~135), Fake in `src/map/adapter.fixtures.ts`. Die
  Kartenfläche umfasst am Handy auch den Teil unter dem Blatt (das Blatt liegt
  absolut über `.map-view`), `map.getBounds()` deckt also die ganze Fläche ab.
- **Tests:** `src/map/image-overlay.test.ts` prüft `defaultImagePlacement`
  (auch mit `null`); `src/app/operations/[id]/image-overlay-actions.test.ts`
  (357 Zeilen, DB über `freshDb()`) prüft `addImageOverlayAction`;
  `src/app/auth-enforcement.test.ts:209` ruft `addImageOverlayAction("op-1",
  file())`. `src/map/SituationMap.test.tsx` (690 Zeilen) nicht erweitern.

## Plan
1. **AC-Test zuerst, rot.** In `image-overlay-actions.test.ts`:
   `addImageOverlayAction(op.id, pngFile(600, 300), { lat, lng, widthM: 4000,
   heightM: 3000 })` legt ein Overlay an, dessen Mitte `lat/lng` ist und dessen
   `scaleM` 2000 ist (Breite begrenzt: 2000 × 1000 m); mit einem Hochformat
   `pngFile(300, 600)` und `widthM: 4000, heightM: 1000` ist `scaleM` 250
   (Höhe begrenzt: 250 × 500 m). Ein Einsatz mit Standard-Ausschnitt anderswo
   ändert daran nichts. Beweis: rot.
2. **Ausdehnung messen.** `src/map/adapter.ts`: neue Methode
   `getViewExtent(): ViewExtent` mit `ViewExtent = { lat, lng, widthM,
   heightM }` (Typ in `src/map/view.ts`). `src/map/leaflet-adapter.ts`: Mitte
   aus `map.getCenter()`, `widthM` = `map.distance` zwischen West- und
   Ostrand auf Höhe der Mitte, `heightM` = zwischen Nord- und Südrand auf
   Länge der Mitte (`map.getBounds()`). Fake in `adapter.fixtures.ts`.
   `src/map/SituationMap.tsx`: `SituationMapHandle.getViewExtent()` (null,
   solange die Karte nicht steht). Beweis: neue
   `src/map/leaflet-adapter.extent.test.ts` (Muster wie
   `leaflet-adapter.zoom.test.ts`): bekannte Containergröße und Zoom → Breite
   und Höhe in Metern stimmen auf 5 %.
3. **Platzierung rechnen.** `src/map/image-overlay.ts`:
   `defaultImagePlacement(extent: ViewExtent, aspect: number)` → Mitte des
   Ausschnitts, `scaleM = min(widthM / 2, heightM / 2 * aspect)`. Der
   Parameter `MapView | null` und der Bezug auf `FALLBACK_VIEW` und
   `DEFAULT_SCALE_M` fallen weg, wo sie nur hierfür da waren. Beweis:
   `src/map/image-overlay.test.ts` angepasst (Querformat, Hochformat,
   quadratisch).
4. **Action.** `addImageOverlayAction(operationId, file, extent)`: prüft
   `extent` (endliche Zahlen, `widthM`/`heightM` > 0, `lat` in −90…90, `lng`
   in −180…180; sonst `ValidationError("Der Kartenausschnitt ist ungültig.")`)
   und nutzt `defaultImagePlacement(extent, width / height)`; `getOperation`
   bleibt für die Existenzprüfung. `auth-enforcement.test.ts` ruft mit einem
   Ausschnitt. Beweis: Test aus Schritt 1 grün; ein Test für den ungültigen
   Ausschnitt.
5. **Client.** `src/map/SituationWorkspace.tsx`: `onAddImage` erhält
   `(file, extent)`; an `LayersPanel` geht `(file) => onAddImage(file,
   mapRef.current?.getViewExtent() …)`. Ist die Karte noch nicht bereit
   (`null`), liefert der Client ohne Hochladen `{ error: "Die Karte lädt
   noch. Bitte erneut versuchen." }` – derselbe Text, den
   `saveDefaultView` in `SituationWorkspace` für denselben Zustand nutzt
   (als gemeinsame Konstante dort herausziehen). `page.tsx` bindet wie bisher. Beweis:
   Workspace-Test in neuer Datei
   `src/map/SituationWorkspace.image-upload.test.tsx`: Datei wählen →
   `onAddImage` bekommt die Ausdehnung des Fake-Adapters.
6. **Im Browser** (`run-einsatz`): Desktop und Handy, an eine andere Stelle
   als den Standard-Ausschnitt zoomen, PNG hochladen → Bild mittig, ganz
   sichtbar; „Bearbeiten“ → alle Griffe im Bild. Beweis: Screenshots; `npm
   run check` grün.

## Not here
- Was nach dem Hochladen gemeldet wird (Benachrichtigung „Bild-Overlays“):
  Ticket 01; dieses Ticket ändert nur, wo das Bild liegt.
- Ersetzen einer Datei behält die Platzierung wie bisher.
- Kein Zoom der Karte aufs Bild (Ruled out).

## Left standing

**Review-Befunde, nicht behoben**

- *Hinter der Datumsgrenze* (Review 1 und 2, Blocker). Leaflet bricht den
  Mittelpunkt nicht auf −180…180 um. Wer nach Osten über 180° hinaus
  geschoben hat, schickt zum Beispiel `lng: 339.8`, und der Server lehnt mit
  „Der Kartenausschnitt ist ungültig.“ ab. Das Umbrechen im Adapter (die
  Korrektur nach Review 1) machte es schlimmer: Das Bild wurde gespeichert,
  lag aber 360° neben der Stelle, auf die man schaut, und war bei
  niemandem zu sehen. Ich habe das deshalb zurückgenommen. Eine Ablehnung,
  die man sieht, ist besser als ein Bild, das man nicht findet. Eine echte
  Lösung (etwa Leaflets `worldCopyJump`) änderte das Verschieben der ganzen
  Karte für alle Ebenen und Ansichten. Das entscheidet dieses Ticket nicht.
  Den Standard-Ausschnitt dort zu speichern, scheitert schon heute auf
  dieselbe Weise.
- *Höhe bei Zoom auf Kontinent-Ebene* (Review 2, Blocker). Die Höhe zählt in
  Metern am Boden, wie AC-14 es verlangt: Nord-Süd-Spanne × 111 320 m. Das
  Bild liegt in Grad gleichmäßig um die Mitte. Web-Mercator streckt die
  Nordhälfte aber, und so ragt ein Hochformat auf einem breiten Bildschirm
  bei Zoom 3–4 über den oberen Rand. Bei 2560 × 1440, Zoom 3 und 60° N
  stünde die Oberkante jenseits des Pols. In Metern am Boden ist AC-14 auch
  dort erfüllt. Ob das Bild auch auf dem Bildschirm in den Ausschnitt passen
  muss, sagen die Kriterien nicht. Auf Straßen- und Stadtebene ist der
  Unterschied nicht zu messen; bei Zoom 13 lag es im Browser genau mittig
  und war 0,500 so breit bzw. hoch wie die Karte.
- *`src/map/SituationWorkspace.tsx` nicht vorher aufgeteilt* (Review 1,
  should-fix). Die Datei bekommt `addImage` und `MAP_LOADING` und hat jetzt
  rund 505 Zeilen. Der Plan sieht keinen eigenen Split vor, und einen Split
  in diesen Commit zu mischen, wäre ein zweites Ticket. Das gehört beim
  Schneiden der Tickets entschieden.

**Ohne automatischen Test geprüft**

- AC-13, „bei allen Clients“ und „auch unter einem offenen Blatt“: Die Tests
  prüfen, dass die Action das Overlay mit der Mitte des übergebenen
  Ausschnitts speichert, dass der Client die Fläche des Adapters schickt und
  dass der Adapter die ganze Containerfläche misst. Dass das Blatt am Handy
  darüber liegt und die Fläche nicht verkleinert, haben die Reviewer im
  Browser gesehen: Bei 360 px mit offenem Ebenen-Blatt lag das Bild mittig
  auf der ganzen Karte (180/361 zu 180/362 px), mit dem unteren Teil unter
  dem Blatt. Andere Clients bekommen die gespeicherte Platzierung wie bei jedem
  Overlay über das Live-Update des Einsatzes. Mit einem zweiten Browser hat
  das niemand geprüft.
- AC-14, „auf 5 % genau“, in der echten Karte: `leaflet-adapter.extent.test.ts`
  misst in jsdom mit Leaflets Projektion. Im Browser bei 2560 × 1440 und
  360 × 740 kam das Bild auf 49,7–50 % der Breite (Querformat) bzw. der Höhe
  (Hochformat); alle sechs Griffe lagen beim Bearbeiten im Ausschnitt.

**Abweichungen vom Plan**

- Schritt 2: `widthM` und `heightM` misst der Adapter nicht mit
  `map.distance`, sondern als Längen- bzw. Breitengrad-Spanne mal Meter pro
  Grad, mit denselben Konstanten wie `fromImageFrame` (`METERS_PER_DEGREE`,
  `metersPerDegLng`, dafür jetzt aus `image-overlay.ts` exportiert).
  `map.distance` misst den Großkreis. Der ist bei weitem Ausschnitt kürzer als
  der Breitenkreis, an dem das Bild ausgelegt wird, und bricht jenseits von
  360° Länge zusammen. Bei Zoom 2 kam das Bild nur auf 3,4 % der Breite
  (Review 1). Zwei Tests in `leaflet-adapter.extent.test.ts` pinnen das.
- Schritt 4: Ausschnitt-Parameter und Prüfung heißen `view` und
  `assertViewExtent`. Die Mittelpunktsprüfung nutzt das bestehende
  `isValidLatLng`. Der Ausschnitt wird vor dem Aufbereiten der Datei
  geprüft, damit eine ungültige Anfrage kein Bild umrechnet. `getOperation`
  bleibt für die Existenzprüfung.
- Schritt 6 (Browser) haben die beiden Reviewer gefahren, nicht der Build.
  Das ist das Vorgehen von `/implement`. Screenshots liegen nicht im Commit.

Von den Nudges bin ich nicht abgewichen.
