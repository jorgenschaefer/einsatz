---
criteria:  CRITERIA.md
closes:
advances:
after:
status:    done
attempts:  1
---

## Build
`src/map/SituationWorkspace.tsx` (709 Zeilen) wird entlang dessen aufgeteilt,
was zusammen geändert wird: Fehlerkanal der Karten-Aktionen, Bereichs-Abläufe,
Bild-Overlay-Bearbeitung, Ebenen-Panel und Modus-Bänder ziehen in eigene
Dateien; `SituationWorkspace.tsx` setzt sie nur noch zusammen. Das Verhalten
ändert sich nicht.

## Done when
- `src/map/useMapActionError.ts` (neu) enthält den Fehlerkanal für Karten-Aktionen
  ohne eigenes Panel: den Zustand `mapError`, `runMapAction` und `showMapError`
  samt dem erklärenden Kommentar (heute Zeilen ~235–237 und ~309–335).
- `src/map/useAreaFlows.ts` (neu) enthält die Bereichs-Abläufe: `selectedAreaId`,
  `circleMoveSaving`, `handleDrawComplete`, `startRedraw`, `startMoveCircle`,
  `setCircleHere` und den Effekt, der das Verschieben eines anderswo gelöschten
  Kreises beendet (heute Zeilen ~269–273 und ~350–399).
- `src/map/useImageOverlayEditing.ts` (neu) enthält die Bild-Overlay-Bearbeitung:
  den `useActionRunner` für Bilder, `endMode` (Bildfehler leeren, Modus
  zurücksetzen), `saveImagePlacement`, `changeImageOpacity`, `replaceImage`,
  `deleteImage` und das Starten der Bearbeitung ohne das Schließen des Blatts
  (heute Zeilen ~238–247, ~284–285 und ~401–427).
- `src/map/LayersPanel.tsx` (neu) rendert den Inhalt des Ebenen-Panels:
  `KmlPanel` und den Abschnitt „Bild-Overlays" mit `ImageOverlayPanel` und
  `ImageOverlayEditor` (heute Zeilen ~588–628).
- `src/map/MapModeBands.tsx` (neu) rendert die vier `ModeBand`s
  („Kartenzeichen platzieren", „Bereich zeichnen", „Kreis verschieben",
  „Bild-Overlay bearbeiten"; heute Zeilen ~512–541).
- `src/map/SituationWorkspace.tsx` enthält keine dieser Teile mehr, nur ihre
  Aufrufe und die Verdrahtung, und ist kürzer als 500 Zeilen.
- Kein Test wurde inhaltlich geändert; die vorhandenen
  `SituationWorkspace.*.test.tsx` decken die verschobenen Teile weiter ab und
  sind grün. `npm run check` ist grün.

## Nudges

## Context
- Die Tests der Komponente sind schon nach Thema aufgeteilt
  (`SituationWorkspace.test.tsx`, `.areas`, `.layers`, `.map-actions`, `.modes`,
  `.panels`, `.symbols`, gemeinsame Helfer in `SituationWorkspace.fixtures.tsx`)
  und prüfen über die gerenderte Komponente; sie bleiben, wie sie sind.
- Reihenfolge der Hooks: `useMainView` braucht `endMode` (für `onMapHidden`),
  `endMode` braucht den Bildfehler – also wird `useImageOverlayEditing` **vor**
  `useMainView` aufgerufen und braucht nichts von dort; das Schließen des
  Blatts am Telefon (`closeSheetOnPhone`) setzt `SituationWorkspace` beim
  Starten der Bearbeitung selbst dazu. `useMapActionError` und `useAreaFlows`
  brauchen `closeSheetOnPhone` und kommen nach `useMainView`; `useAreaFlows`
  bekommt `runMapAction`, die Werte aus `useMapMode`, `mapRef` und die
  Bereichs-Actions übergeben.
- Vorbilder für ausgelagerte Hooks im selben Ordner: `useMapMode.ts`,
  `useMainView.ts`, `useMapFocus.ts`.
- Grund für diesen Ticket: Mehrere Builds in Folge haben Code in diese Datei
  gelegt, statt sie vorher aufzuteilen.

## Plan
1. **Ausgangslage festhalten:** `npm run check` grün, Zeilenzahl notieren.
2. **`useMapActionError.ts`** herausziehen; `SituationWorkspace.tsx` ruft ihn.
   Beweis: `SituationWorkspace.map-actions.test.tsx` und
   `SituationWorkspace.areas.test.tsx` grün.
3. **`useAreaFlows.ts`** herausziehen. Beweis: `SituationWorkspace.areas.test.tsx`
   und `SituationWorkspace.modes.test.tsx` grün.
4. **`useImageOverlayEditing.ts`** herausziehen. Beweis:
   `SituationWorkspace.layers.test.tsx` und `SituationWorkspace.modes.test.tsx`
   grün.
5. **`LayersPanel.tsx`** herausziehen (Props: die KML- und Bild-Actions, die
   Overlays, `editingImageId` und was `useImageOverlayEditing` liefert).
   Beweis: `SituationWorkspace.layers.test.tsx` grün.
6. **`MapModeBands.tsx`** herausziehen (Props: welche Modi aktiv sind,
   `endMode`, `setCircleHere`, `circleMoveSaving`). Beweis:
   `SituationWorkspace.modes.test.tsx` grün.
7. **Aufräumen:** ungenutzte Imports in `SituationWorkspace.tsx` entfernen;
   Zeilenzahl < 500; `git diff --stat` zeigt keine Änderung an `*.test.tsx`.
8. `npm run check` grün.

## Not here
- Keine Verhaltensänderung, keine neuen Funktionen; Suchtreffer, Trefferliste
  und Zoomregel kommen in `01`, `02` und `03`.
- Die Props-Schnittstelle `SituationWorkspaceProps` und der Aufrufer
  (`src/app/operations/[id]/page.tsx`) bleiben unverändert.
- Die Suche (`SearchBar`, `useMapSearch`, `useMapFocus`) bleibt in
  `SituationWorkspace.tsx`; `01` verdrahtet sie dort.

## Left standing
- Abweichung vom Plan: Die fünf genannten Teile allein ließen
  `SituationWorkspace.tsx` bei 550 Zeilen; die Annahme in Schritt 7 (< 500)
  ging nicht auf. Nach demselben Grundsatz – was zusammen geändert wird –
  sind zusätzlich herausgezogen: `useSymbolPlacement.ts` (Kartenzeichen scharf
  schalten und platzieren samt „Erweitert …"-Dialogzustand, das Gegenstück zu
  `useAreaFlows`), `MapErrorAlert.tsx` (die Anzeige des Fehlerkanals über der
  Karte), `MapPanelSheet.tsx` (Rahmen des Kartenpanels mit Titel und
  Schließen-Knopf) und `toggleAreaDraw` in `useAreaFlows`. Ergebnis: 496 Zeilen.
- `showMapError` ist in `useMapActionError` intern; nach außen gehen nur
  `mapError`, `dismissMapError` und `runMapAction`, weil niemand sonst
  `showMapError` aufruft.
- `useImageOverlayEditing` und `LayersPanel` importieren die Typen
  `WorkspaceImageOverlay`/`WorkspaceKmlOverlay` aus `SituationWorkspace.tsx`
  (nur `import type`, also kein Laufzeit-Zyklus). Die Typen zu verschieben
  hätte den Import im Aufrufer berührt, der hier unverändert bleibt.
- Review-Nit nicht behoben: `endMode` beendet jeden Karten-Modus, steckt aber
  in `useImageOverlayEditing` und wird als `imageEditing.endMode` verdrahtet;
  nur der Doc-Kommentar des Hooks sagt das. Das Ticket legt `endMode` bewusst
  dorthin (er muss den Bildfehler leeren); eine Umbenennung habe ich nicht
  vorgenommen, um bei den Namen des Tickets zu bleiben.
- Das unveränderte Verhalten ist durch die vorhandenen Tests belegt (keine
  `*.test.tsx` geändert, 1523 Tests grün). Zusätzlich hat der Review die
  laufende App auf 1920×1080 und 390×844 gefahren: Kartenzeichen platzieren
  samt Fehler-Alert bei getrenntem Netz, Kreis zeichnen und verschieben,
  Bild-Overlay bearbeiten samt Bildfehler und „Fertig", Schließen des Blatts am
  Telefon – alles wie vorher. 390×844 war ein verkleinertes Fenster, kein
  Touch-Kontext.
