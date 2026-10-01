---
criteria:  CRITERIA.md
closes:
advances:
after:
status:    done
attempts:  1
---

## Build
Die KML-Hilfsfunktionen ziehen aus `src/map/leaflet-adapter.ts` (593 Zeilen)
in eine eigene Datei `src/map/kml-layer.ts`, ihre Tests aus
`src/map/leaflet-adapter.conversion.test.ts` nach `src/map/kml-layer.test.ts`.
Das Verhalten ändert sich nicht.

## Done when
- `src/map/kml-layer.ts` enthält `KML_ICON_BASE`, `hotspotAxisToPixels`,
  `kmlIconAnchor`, `kmlIconOptions`, `kmlPathStyle`, `kmlPopupContent` und
  `parseKml`; `src/map/leaflet-adapter.ts` enthält sie nicht mehr und
  importiert `parseKml` von dort.
- `src/map/kml-layer.test.ts` enthält die Tests `describe("parseKml")`,
  `describe("kmlPopupContent")` und `describe("kmlIconOptions")`;
  `src/map/leaflet-adapter.conversion.test.ts` behält nur `extractGeometry`.
- `vitest.config.mts` führt `src/map/kml-layer.test.ts` in `browserTestsInTs`.
- Kein Test wurde inhaltlich geändert, `npm run check` ist grün.

## Nudges

## Context
- `src/map/leaflet-adapter.ts` ist der einzige Ort, der direkt mit Leaflet
  spricht, und mit 593 Zeilen groß. Ticket 03 baut den KML-Punkt ohne Symbol
  als Kreis um und würde dafür in diese Datei schreiben; der Projektstandard
  verlangt, eine große Datei vorher zu teilen.
- Die KML-Teile stehen zusammenhängend zwischen `MARKER_SIZE` und
  `leafletMapAdapterFactory` (etwa Zeile 98–235): `KML_ICON_BASE`,
  `hotspotAxisToPixels`, `kmlIconAnchor`, `kmlIconOptions`, `kmlPathStyle`,
  `kmlPopupContent`, `parseKml`. Sie hängen nur an `leaflet` (`L`) und an
  `@tmcw/togeojson` (`kmlToGeoJson`), nicht an anderen Teilen des Adapters.
  `parseKml` wird im Adapter einmal benutzt (`setKmlOverlay`, etwa Zeile 515).
- `MARKER_SIZE` gehört zu den Kartenzeichen und bleibt im Adapter.
- `src/map/leaflet-adapter.conversion.test.ts` testet `extractGeometry`,
  `parseKml`, `kmlPopupContent` und `kmlIconOptions`.
- Andere Importe dieser Funktionen gibt es nicht (`grep -rn "parseKml\|kmlIconOptions\|kmlPopupContent" src`).

## Plan
1. **Neue Datei `src/map/kml-layer.ts`** mit den genannten Konstanten und
   Funktionen, unverändert verschoben, samt ihrer Kommentare. Importe:
   `import L from "leaflet";` und `import { kml as kmlToGeoJson } from "@tmcw/togeojson";`.
   Exportiert bleiben, was heute exportiert ist (`kmlIconOptions`,
   `kmlPopupContent`, `parseKml`). Beweis: `npx tsc --noEmit`.
2. **`src/map/leaflet-adapter.ts`**: die verschobenen Teile und den
   togeojson-Import entfernen, `import { parseKml } from "./kml-layer";`
   ergänzen. Den Kommentar über `leafletMapAdapterFactory` („Der einzige Ort,
   der direkt mit Leaflet spricht“) anpassen: Leaflet steckt jetzt in
   `leaflet-adapter.ts` und `kml-layer.ts`. Beweis: `npx tsc --noEmit`;
   `grep -n "kmlIcon\|kmlPath\|kmlPopup\|hotspot\|togeojson" src/map/leaflet-adapter.ts`
   findet nichts.
3. **Tests teilen**: `src/map/kml-layer.test.ts` braucht ein DOM
   (`DOMParser`, `document`, Leaflet). Deshalb in `vitest.config.mts`
   `"src/map/kml-layer.test.ts"` zu `browserTestsInTs` hinzufügen, sonst
   läuft er unter Node. Dann die drei `describe`-Blöcke `parseKml`, `kmlPopupContent`,
   `kmlIconOptions` wörtlich nach neuem `src/map/kml-layer.test.ts`
   verschieben, mit Import aus `./kml-layer`; in
   `src/map/leaflet-adapter.conversion.test.ts` bleibt `extractGeometry`.
   Beweis: `npx vitest run src/map/kml-layer.test.ts src/map/leaflet-adapter`
   grün, gleiche Anzahl Tests wie vorher.
4. `npm run check` grün.

## Not here
- Kein neues Verhalten: Der Kreis für KML-Punkte ohne Symbol ist Ticket 03.
- `src/map/SituationWorkspace.tsx` (717 Zeilen) wird nicht geteilt: Ticket 02
  ändert dort nur wenige Zeilen in `runMapAction`, ohne Code hinzuzufügen.

## Left standing
- Nicht im Browser geprüft: Weder Build noch Review haben die Lagekarte mit
  einer KML-Ebene angesehen. Begründung: Code und Tests sind byte-gleich
  verschoben (per `diff` gegen `HEAD` geprüft), `parseKml` wird weiter nur
  über den dynamisch geladenen Adapter erreicht; die 33 Tests in
  `kml-layer.test.ts` und `leaflet-adapter.*` laufen wie vorher alle grün.
- Abweichung vom Plan (Kleinigkeit): Im neuen `kml-layer.test.ts` wird
  `leaflet` als `import type L` importiert, weil der Test `L` nur noch für
  Typen braucht. Der Inhalt der Tests ist unverändert.
