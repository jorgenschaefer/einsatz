---
criteria:  CRITERIA.md
closes:    AC-12
advances:  AC-4
after:     01-benachrichtigungen-fuer-die-panels
status:    done
attempts:  1
---

## Build
Scheitert das Speichern einer Platzierungs-Geste im Bild-Overlay-Editor,
springen Bild und Griffe auf die gespeicherte Platzierung zurück, und die
Meldung erscheint als Benachrichtigung „Bild-Overlays“ statt im Editor. Die
übrigen Editor-Aktionen schließen diese Benachrichtigung.

## Done when
> **AC-12** Scheitert das Speichern von Verschieben, Skalieren oder Drehen eines Bild-Overlays, stehen Bild und alle Griffe danach auf der gespeicherten Platzierung, und es erscheint eine Benachrichtigung „Bild-Overlays“ mit der Meldung. Im Editor erscheint dazu keine Meldung.

Von AC-4 unter `## Toward` wird hier wahr: Die Benachrichtigung
„Bild-Overlays“ schließt sich auch, wenn eine neue Platzierung gespeichert
wird (Ende einer Verschieben-, Skalieren- oder Drehen-Geste), wenn man die
Deckkraft ändert, „Ersetzen“ wählt, „Löschen“ bestätigt oder „Fertig“ tippt –
im Editor wie im Band über der Karte.

## Toward
> **AC-4** Je Quelle steht höchstens eine Benachrichtigung. Sie schließt sich, sobald man in derselben Quelle etwas Neues beginnt – KML: Datei wählen, Sichtbarkeit schalten, „Neu laden“, „Per URL einbinden“, „Entfernen“ öffnen, Entfernen bestätigen; Bild-Overlays: Datei wählen, Sichtbarkeit schalten, „Bearbeiten“, eine neue Platzierung wird gespeichert (Ende einer Verschieben-, Skalieren- oder Drehen-Geste), Deckkraft ändern, „Ersetzen“, „Löschen“ bestätigen, „Fertig“; Ansichtslinks: „Ansichtslink erzeugen“, Löschen-Rückfrage öffnen, Löschen bestätigen; Karte: ein Kartenmodus beginnt oder wird beendet (Kartenzeichen scharf schalten, Zeichnen oder Neu zeichnen beginnen, Kreis „Verschieben“, Bild „Bearbeiten“, „Abbrechen“, „Fertig“, „Hier setzen“) oder ein Kartenzeichen wird gesetzt. Endet ein Kartenmodus nur, weil die Karte ausgeblendet wird (am Handy Wechsel zu ETB oder Stärke, Fenster schmaler als 48 em), bleibt die Benachrichtigung „Karte“ stehen. Eine Meldung, die eintrifft, während eine Rückfrage offen ist, schließt erst das Bestätigen; bis dahin ist sie zu sehen (AC-7).

## Nudges
> `saveImagePlacement` in `useImageOverlayEditing` läuft über den Hook der Quelle „Bild-Overlays“ (die Benachrichtigung schließt beim Speichern am Ende der Geste); Deckkraft und Ersetzen behalten ihren eigenen `useActionRunner` für den Editor und schließen beim Start zusätzlich die Benachrichtigung „Bild-Overlays“, ebenso „Löschen“ und „Fertig“.

> AC-12: Nach einem Fehler setzt der Adapter das Overlay aus der gespeicherten Platzierung neu, statt die unveränderte Signatur zu überspringen.

## Context
- **Nach Ticket 01** gibt es `useNotifyingActionRunner(source)`
  (`src/app/useNotifyingActionRunner.ts`, `{ busy, run, closeError }`),
  `closeActionError(source)` (`src/app/action-notification.ts`) und die Quelle
  `BILD_OVERLAYS` (`src/map/notification-sources.ts`). Das Bild-Overlay-Panel
  meldet schon darüber; „Bearbeiten“ schließt die Benachrichtigung bereits.
- **Editor heute:** `useImageOverlayEditing` (`src/map/useImageOverlayEditing.ts`)
  hält einen `useActionRunner` (`persistImage`) für Platzierung, Deckkraft und
  Ersetzen; `ImageOverlayEditor` zeigt dessen `error` inline und sperrt mit
  `busy`. `deleteImage` läuft ohne Runner; sein Fehler steht im
  `ConfirmationModal` des Editors. Das Bearbeiten endet über `mode.reset`:
  im Editor über „Fertig“ (`LayersPanel` → `onEndMode`) und im Band über der
  Karte (`MapModeBands`, `onEndMode={mode.reset}` in `SituationWorkspace`,
  ein Handler für alle Bänder).
- **Warum das Bild heute stehen bleibt:** Während einer Geste zeichnet der
  Adapter (`src/map/leaflet-adapter.ts`, `previewPlacement`) nur die Leaflet-
  Ebene neu; am `dragend` meldet er die Platzierung (`editing.onChange`).
  `imageSpecs` hält weiter die gespeicherte Platzierung. `SituationMap`
  setzt Overlays nur neu, wenn sich `imageOverlays` ändern; nach einem Fehler
  ändert sich nichts, und `setImageOverlay` überspringt eine unveränderte
  Signatur (`imageSigs`).
- **Fake-Adapter:** `src/map/adapter.fixtures.ts` liefert den Adapter der
  Workspace-Tests; neue Adapter-Methoden brauchen dort ein `vi.fn()`.
- `src/map/SituationMap.test.tsx` hat 690 Zeilen: nicht erweitern.
- `src/map/SituationWorkspace.layers.test.tsx` erwartet heute, dass ein
  gescheitertes Verschieben (`moveOnMap`, Zeile ~208) im Editor gemeldet
  wird; das kehrt AC-12 um.

## Plan
1. **AC-Test zuerst, rot.** Neue Datei
   `src/map/SituationWorkspace.image-placement.test.tsx`: Bild-Overlay
   bearbeiten, über den Fake-Adapter eine Platzierung melden
   (`startImageOverlayEdit`-Callback aufrufen), `onUpdateImagePlacement`
   liefert `{ error }` bzw. wirft → eine Benachrichtigung „Bild-Overlays“ mit
   der Meldung, im Editor kein `role="alert"`, und der Adapter bekommt
   `restoreImageOverlay(id)`. Danach: Deckkraft ändern, „Ersetzen“, „Löschen“
   bestätigen, „Fertig“ im Editor, „Fertig“ im Band und eine neue Platzierung
   schließen die Benachrichtigung je einzeln. Beweis: rot.
2. **Adapter stellt zurück.** `src/map/adapter.ts`: neue Methode
   `restoreImageOverlay(id: string): void`. `src/map/leaflet-adapter.ts`:
   Signatur von `id` vergessen und `setImageOverlay(id, imageSpecs.get(id))`
   neu ausführen (baut Ebene und, im Bearbeiten, die Griffe neu). Fake in
   `src/map/adapter.fixtures.ts`. Beweis: neue
   `src/map/leaflet-adapter.image-restore.test.ts` (Muster wie
   `leaflet-adapter.kml-point.test.ts`, mit `clientWidth`/`clientHeight` am
   Container): Overlay setzen, Bearbeiten starten. Die Griffe sind im
   Adapter privat; der Test fängt sie über
   `vi.spyOn(L.Marker.prototype, "addTo")` ab, setzt am Verschiebe-Griff
   `setLatLng(…)` und feuert `drag` und `dragend` (der Adapter liest
   `marker.getLatLng()`). Dann `restoreImageOverlay(id)` → die zuletzt
   erzeugten Griffe stehen auf `imageOverlayHandles(gespeichert)`, und der
   letzte Aufruf von `L.imageOverlay.rotated` (per Spy) bekam die Ecken aus
   `imageOverlayCorners(gespeichert)`.
3. **Durch die Karte reichen.** `src/map/SituationMap.tsx`:
   `SituationMapHandle.restoreImagePlacement(id)` ruft den Adapter. Beweis:
   `npx tsc --noEmit`; Test aus Schritt 1.
4. **Editor-Hook.** `src/map/useImageOverlayEditing.ts`:
   `saveImagePlacement` läuft über `useNotifyingActionRunner(BILD_OVERLAYS)`;
   bei `result?.error` ruft es `restorePlacement(id)` (neuer Parameter, aus
   `SituationWorkspace` als `(id) => mapRef.current?.restoreImagePlacement(id)`).
   `changeImageOpacity`, `replaceImage` und `deleteImage` rufen zu Beginn
   `closeActionError(BILD_OVERLAYS)`; neu `finishEdit()` schließt sie und ruft
   `mode.reset()`. `busy` des Editors = beide Runner. Beweis: Test aus
   Schritt 1, Teil Benachrichtigung und Schließen.
5. **Bestehende Tests umstellen.** `src/map/SituationWorkspace.layers.test.tsx`:
   in „shows the failure in the editor when %s throws and leaves it usable“
   die Zeile „moving it on the map“ (`moveOnMap`) herausnehmen – ihr Fall
   steht jetzt im Test aus Schritt 1; die Zeilen für Deckkraft und Ersetzen
   bleiben, sie pinnen AC-11 für den Editor. „forgets the failure once
   editing is finished from %s“ und die Redirect-Zeile, die `moveOnMap`
   nutzen, auf Deckkraft oder Ersetzen umstellen. Beweis: `npm test` grün.
6. **„Fertig“ verdrahten.** `src/map/LayersPanel.tsx`: `onDone` des Editors
   ruft `imageEditing.finishEdit`. `src/map/SituationWorkspace.tsx`: das Band
   ruft im Bearbeiten `imageEditing.finishEdit`, sonst `mode.reset` (etwa ein
   `endMode`, der danach unterscheidet). Beweis: Test aus Schritt 1 grün;
   `npm run check` grün.

## Not here
- Die Benachrichtigung „Karte“ und das Schließen bei Moduswechseln: Ticket 03.
  „Fertig“ beendet auch einen Kartenmodus; dass das zusätzlich „Karte“
  schließt, baut Ticket 03 an den Übergängen von `useMapMode`.
- Fehler von Deckkraft, Ersetzen und Löschen bleiben im Editor bzw. in dessen
  Rückfrage (AC-11, geprüft in Ticket 03).
- Wo ein neues Bild-Overlay startet: Ticket 04.

## Left standing

**Review-Befunde, nicht behoben**

- *Am Handy verdeckt die Benachrichtigung das Band „Bild-Overlay
  bearbeiten“ samt „Fertig“* (Review 1, should-fix). Bei 360 px liegt sie
  oben mittig (y 52–135) über dem Band; ein Tipp auf „Fertig“ im Band trifft
  die Benachrichtigung. Weil sie sich nicht von selbst schließt, ist das
  Band nach jeder gescheiterten Geste verdeckt, bis man sie mit „ד schließt
  oder das Ebenen-Blatt öffnet. Die Position stammt aus Ticket 01 (AC-1).
  Das muss auf der Ebene der Kriterien entschieden werden, nicht hier.
  Ticket 03 bekommt dasselbe für „Karte“ über jedem Modus-Band.
- *Ein Name für „zurück auf die gespeicherte Platzierung“* (Review 2, Nit,
  teilweise behoben). Kartenhandle und Hook heißen jetzt beide
  `restoreImagePlacement`. Die Adapter-Methode heißt weiter
  `restoreImageOverlay`, passend zu `setImageOverlay` und
  `removeImageOverlay` im selben Interface.

**Ohne automatischen Test geprüft**

- AC-12, „Bild und alle Griffe stehen danach auf der gespeicherten
  Platzierung“: `leaflet-adapter.image-restore.test.ts` prüft das in jsdom
  an den Leaflet-Objekten (Griff-Positionen, Ecken der Ebene auf der Karte),
  nicht am gezeichneten Bild. Der Reviewer hat im Browser bei 1920 px (Maus)
  und 360 px (Touch) Verschieben, Skalieren und Drehen offline scheitern
  lassen. Bild und alle sechs Griffe sprangen jeweils auf die gespeicherte
  Platzierung zurück, die Benachrichtigung erschien, und der Editor zeigte
  nichts. Im Browser nur mit geworfenem Fehler geprüft; einen vom Server
  zurückgegebenen Fehler decken nur die Tests ab.
- AC-4 (Teil): Das Schließen hat der Reviewer am Desktop für alle sechs
  Aktionen gesehen, am Handy nur für „Fertig“ im Editor. Die übrigen Fälle
  am Handy decken die Tests ab.

**Abweichungen vom Plan**

- Schritt 2: Der Adapter-Test prüft nicht den letzten Aufruf von
  `L.imageOverlay.rotated`, weil der schon beim ersten Setzen die
  gespeicherten Ecken bekommt und der Test dann auch ohne Zurückstellen grün
  wäre. Er liest stattdessen `_topLeft`, `_topRight` und `_bottomLeft` der
  einen Ebene, die auf der Karte liegt. Das sind private Felder des Plugins.
- Schritt 5: Die Redirect-Zeile für die Geste auf der Karte bleibt, statt auf
  Deckkraft oder Ersetzen umgestellt zu werden. Für beide gibt es schon
  eigene Zeilen, und dass eine Geste bei einer Weiterleitung nichts meldet,
  gilt weiter. Der Helfer heißt jetzt `scaleOnMap` und liegt in
  `SituationWorkspace.fixtures.tsx`, weil beide Testdateien ihn brauchen
  (Review 2). Die Zeile heißt deshalb „scaling it on the map“.
- Zusätzlich: Eine gespeicherte Platzierung löscht weiter die Meldung einer
  gescheiterten Deckkraft-Änderung im Editor. Vorher lief beides über
  denselben Runner; nach der Trennung wäre das stillschweigend weggefallen.
  Ein Test in `SituationWorkspace.image-placement.test.tsx` pinnt es.
- Zusätzlich: Dass der Editor während des Speicherns einer Platzierung
  gesperrt ist (`busy` aus beiden Runnern), pinnt ein Test (Review 1,
  should-fix).
- `LayersPanel` hat die Prop `onEndMode` nicht mehr. „Fertig“ im Editor ruft
  `imageEditing.finishEdit`; das Band wählt in `SituationWorkspace` inline
  zwischen `finishEdit` (beim Bearbeiten eines Bildes) und `mode.reset`.
- `src/map/SituationWorkspace.tsx` (jetzt 497 Zeilen) und
  `src/map/leaflet-adapter.ts` (467) wachsen um ein paar Zeilen, ohne vorher
  aufgeteilt zu werden. Der Plan sieht dafür kein eigenes Ticket vor.

Von den Nudges bin ich nicht abgewichen.
