---
criteria:  CRITERIA.md
closes:    AC-13, AC-14
advances:
after:
status:    ready
attempts:  0
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
