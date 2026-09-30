---
criteria:  CRITERIA.md
closes:    AC-2, AC-3, AC-7
advances:
after:     01-ansichtslink-live-und-pflicht-props
status:    ready
attempts:  0
---

## Build
Ein kleiner Hook kapselt `busy`, `error` und das Ausführen einer Action samt
Catch-all. Er ersetzt die drei gleichen Stellen im Ebenen-Panel und im
Bild-Overlay-Editor, und `ViewLinkPanel` zeigt damit Fehler beim Erzeugen.
Wirft ein Aufruf, erscheint „Das hat nicht geklappt. Bitte erneut
versuchen.“; eine laufende Navigation zur Anmeldung zeigt keine Meldung.

## Done when
> **AC-2** Scheitert das Erzeugen eines Ansichtslinks, erscheint im Panel „Ansichtslinks teilen“ eine rote Meldung: die zurückgegebene Fehlermeldung oder bei einem unerwarteten Fehler „Das hat nicht geklappt. Bitte erneut versuchen.“ Die Bezeichnung bleibt im Feld, der Knopf ist wieder bedienbar. Nach erfolgreichem Erzeugen ist das Feld leer und keine Meldung zu sehen.

> **AC-3** Wirft der Aufruf einer dieser Aktionen im Client (z. B. Server nicht erreichbar, oder ein Serverfehler, für den die Action keine eigene Meldung hat), erscheint „Das hat nicht geklappt. Bitte erneut versuchen.“ dort, wo die Aktion heute ihre Fehler zeigt (Ebenen-Panel bzw. Bild-Overlay-Editor): KML-Datei einbinden, KML per URL einbinden, KML-Sichtbarkeit, KML neu laden, Bild-Overlay einbinden, Bild-Overlay-Sichtbarkeit, Deckkraft, Position und Größe, Bild ersetzen. Der Ladezustand endet, und jeder Schalter zeigt den gespeicherten Zustand.

> **AC-7** Ohne Anmeldung ändert keine Einsatz-Action etwas. Ist die Sitzung abgelaufen, führt jede in AC-2 und AC-3 genannte Aktion zur Anmeldeseite, ohne vorher eine Fehlermeldung zu zeigen.

## Nudges
> Der Hook ersetzt `run` in `KmlPanel` und `ImageOverlayPanel` und `persistImage` in `SituationWorkspace`, und `ViewLinkPanel` nutzt ihn beim Erzeugen. Er erkennt eine laufende Navigation wie `ConfirmationModal` und zeigt dann keine Meldung; `isNextNavigation` dafür aus `src/app/ConfirmationModal.tsx` herauslösen und teilen, statt es zu kopieren.

> `SymbolDetailModal`, `AreaEditorModal`, `JournalPanel`, `StrengthPanel` und `runMapAction` in `SituationWorkspace` nicht anfassen.

## Context
- Die drei gleichen Stellen, alle ohne catch (ein geworfener Fehler wird zur
  unbehandelten Rejection, `busy` endet über `finally`, keine Meldung):
  - `run` in `src/map/KmlPanel.tsx:54-63`, genutzt von `addUrl`, `addFile`,
    dem Sichtbarkeits-Schalter und „Neu laden“. `addFile` setzt Lesefehler
    der Datei selbst über `setError`; `remove` (über `ConfirmationModal`)
    löscht bei Erfolg die Panel-Meldung mit `setError(null)`.
  - `run` in `src/map/ImageOverlayPanel.tsx:45-54`, genutzt von `add` und dem
    Sichtbarkeits-Schalter.
  - `persistImage` in `src/map/SituationWorkspace.tsx:409-415` mit
    `imageBusy`/`imageError`, genutzt von `saveImagePlacement` (Geste auf der
    Karte: Position und Größe), `changeImageOpacity` und `replaceImage`;
    `startEditImage` und `endMode` (`SituationWorkspace.tsx:252-255`) setzen
    `setImageError(null)`. Die Meldung zeigt
    `ImageOverlayEditor` (`error`, `busy`).
- `ViewLinkPanel` (`src/map/ViewLinkPanel.tsx`): `create` setzt `creating`,
  ruft `onCreate(label.trim())`, leert das Feld und hat keine Meldung.
  Nach `01` liefert `onCreate` ein `ActionResult`.
- `src/app/ConfirmationModal.tsx` hat `FAILURE` („Das hat nicht geklappt.
  Bitte erneut versuchen.“) und `isNextNavigation(error)` (über
  `unstable_rethrow`); bei einer Navigation bleibt der Knopf im Ladezustand
  und es erscheint keine Meldung. Wie man einen Redirect im Test erzeugt,
  zeigt `src/app/ConfirmationModal.test.tsx:119-130` (`redirect()` aus
  `next/navigation` im Mock aufrufen und den geworfenen Fehler werfen).
- Server-Seite von AC-7: `src/app/auth-enforcement.test.ts` ruft jede
  Einsatz-Action ohne Sitzung und erwartet den Redirect ohne Schreiben; er
  bleibt grün. `requireUser` läuft in `operationAction` vor `run`, außerhalb
  jedes Catch-all.
- Die Schalter sind kontrolliert (`checked={overlay.visible}`), der
  Deckkraft-Regler folgt `editingImage.placement.opacity`; nach einem
  Fehlschlag zeigen sie also von selbst den gespeicherten Zustand.

## Plan
1. **Tests, wo der Nutzer handelt, rot.** Je Aktion ein Fall mit einer Action,
   die `new Error("offline")` wirft (→ Alert mit „Das hat nicht geklappt. Bitte
   erneut versuchen.“, Knopf/Schalter wieder bedienbar), und einer, die einen
   Redirect wirft (→ kein Alert). Mit `it.each` je Datei:
   - `src/map/KmlPanel.test.tsx`: Datei einbinden, per URL einbinden
     (Name und URL bleiben im Feld), Sichtbarkeit (Schalter zeigt weiter
     `visible`), Neu laden.
   - `src/map/ImageOverlayPanel.test.tsx`: einbinden, Sichtbarkeit (Schalter
     zeigt weiter `visible`).
   - `src/map/SituationWorkspace.layers.test.tsx`: Deckkraft, Position und
     Größe (Geste wie in „saves the placement from a map gesture …“), Bild
     ersetzen; Meldung im Editor.
   - `src/map/ViewLinkPanel.test.tsx` (AC-2): zurückgegebenes
     `{ error: "…" }` → diese Meldung; geworfener Fehler → Fallback-Text;
     beide Male bleibt die Bezeichnung im Feld und der Knopf ist bedienbar;
     danach Erfolg → Feld leer, keine Meldung; Redirect → keine Meldung.
   *Beweis:* die Fälle mit Meldung schlagen fehl.
2. **Navigation erkennen teilen.** `isNextNavigation` und den Text
   `FAILURE` aus `ConfirmationModal.tsx` in `src/app/action-failure.ts` (neu)
   verschieben und exportieren (`isNextNavigation`, `ACTION_FAILED`);
   `ConfirmationModal` importiert sie. Der JSDoc-Kommentar zieht mit.
   *Beweis:* `src/app/ConfirmationModal.test.tsx` grün.
3. **Hook.** `src/app/useActionRunner.ts` (neu):
   `useActionRunner()` → `{ busy, error, setError, run }`;
   `run(action: () => Promise<ActionResult>): Promise<ActionResult | null>`
   setzt `busy`, übernimmt `result.error ?? null` als `error` und liefert das
   Ergebnis; wirft `action`, dann bei einer Navigation keine Meldung, `busy`
   bleibt gesetzt, Ergebnis `null` (wie `ConfirmationModal`, das dann ohne
   Erfolgsbehandlung zurückkehrt); sonst `error = ACTION_FAILED`, Ergebnis
   `{ error: ACTION_FAILED }`. Aufrufer behandeln nur ein Ergebnis ohne
   `error` als Erfolg (`result && !result.error`). `busy` endet in allen Fällen außer
   der Navigation.
   Unit-Tests in `src/app/useActionRunner.test.ts` (neu) mit `renderHook`:
   Erfolg, zurückgegebener Fehler, geworfener Fehler, Redirect.
   *Beweis:* diese Tests grün.
4. **`KmlPanel` und `ImageOverlayPanel` umstellen.** Eigene
   `busy`/`error`-States und `run` durch den Hook ersetzen; Aufrufe als Thunk
   (`run(() => onAddUrl(…))`). `addFile` und `remove` nutzen `setError`.
   *Beweis:* die Schritt-1-Fälle beider Panels grün, übrige Tests der Dateien
   grün.
5. **`persistImage` umstellen.** In `SituationWorkspace.tsx`
   `imageBusy`/`imageError`/`persistImage` durch den Hook ersetzen, an der
   Stelle der bisherigen `useState`-Zeilen (vor `endMode`); `startEditImage`
   und `endMode` nutzen `setError(null)`. `runMapAction` bleibt.
   *Beweis:* Schritt-1-Fälle in `SituationWorkspace.layers.test.tsx` grün.
6. **`ViewLinkPanel`.** `creating` durch den Hook ersetzen; Alert
   (`<Alert color="red" role="alert">`) über der Eingabezeile wie in
   `KmlPanel`; das Feld wird nur geleert, wenn `run` ein Ergebnis ohne Fehler
   liefert (nicht bei `null`).
   *Beweis:* Schritt-1-Fälle in `ViewLinkPanel.test.tsx` grün, „disables the
   create button while a creation is in flight“ grün.
7. **Abschluss.** *Beweis:* `npm run check` grün; im Browser (Skill
   `run-einsatz`) bei 360 px Breite „Ansichtslinks teilen“ öffnen und prüfen,
   dass die Meldung (z. B. mit gestopptem Server) nicht waagerecht überläuft.

Entschieden: Name und Ort `useActionRunner` in `src/app/useActionRunner.ts`
neben `action-result.ts`, und `src/app/action-failure.ts` für die geteilte
Erkennung und den Text.

## Not here
- `SymbolDetailModal`, `AreaEditorModal`, `JournalPanel`, `StrengthPanel` und
  `runMapAction`: Sie unterscheiden sich gewollt (schließen bei Erfolg,
  Entwurf leeren, gemeinsamer Kartenfehler-Kanal); kein gemeinsamer Hook für
  sie (Out of scope der Änderung).
- Andere Fehlertexte in bestehenden Dialogen und Panels, auch nicht in
  `ConfirmationModal` (Out of scope der Änderung).
- Server-Seite der Fehler: `02-fallback-meldung-in-operation-action`, das
  parallel laufen kann.

## Left standing
