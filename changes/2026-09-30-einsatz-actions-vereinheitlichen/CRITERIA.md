# Criteria: Einsatz-Actions vereinheitlichen

## Problem

Einsatz-Mutationen laufen auf mehreren leicht verschiedenen Wegen, und die
Abweichungen sind nicht gewollt:

- Ein neuer Ansichtslink erscheint bei anderen offenen Clients erst nach
  Neuladen, ein gelöschter verschwindet dagegen live.
- Wirft eine Action (DB- oder Netzfehler), zeigen Ebenen-Panel und
  Bild-Overlay-Editor nichts an; ein Schalter springt still zurück.
- Unerwartete Fehler der Bild-Actions werden protokolliert, die der
  KML-Actions nicht.
- Props-Typen erklären Werte für optional, die die Produktion immer setzt. Ein
  echtes Fehlen fiele nicht auf: Ein Kartenzeichen würde still als „manuell“
  und nie als veraltet gezeigt.

Stattdessen erscheint jede Änderung live bei allen Clients, jeder Fehlschlag
zeigt eine Meldung, jeder unerwartete Serverfehler wird protokolliert, und die
Typen sagen, was immer da ist.

Gefunden im Vereinfachungs-Durchgang vom 2026-09-28 (festgehalten in Commit
`5d394b0`); zu sehen an `createViewLinkAction` in
`src/app/operations/[id]/view-link-actions.ts` und an `run` in
`src/map/KmlPanel.tsx`. Einen Vorfall im Einsatz gab es nicht.

## Acceptance criteria

- **AC-1** Legt eine Führungskraft einen Ansichtslink an, erscheint er bei allen anderen angemeldeten Clients desselben Einsatzes ohne Neuladen.
- **AC-2** Scheitert das Erzeugen eines Ansichtslinks, erscheint im Panel „Ansichtslinks teilen“ eine rote Meldung: die zurückgegebene Fehlermeldung oder bei einem unerwarteten Fehler „Das hat nicht geklappt. Bitte erneut versuchen.“ Die Bezeichnung bleibt im Feld, der Knopf ist wieder bedienbar. Nach erfolgreichem Erzeugen ist das Feld leer und keine Meldung zu sehen.
- **AC-3** Wirft der Aufruf einer dieser Aktionen im Client (z. B. Server nicht erreichbar, oder ein Serverfehler, für den die Action keine eigene Meldung hat), erscheint „Das hat nicht geklappt. Bitte erneut versuchen.“ dort, wo die Aktion heute ihre Fehler zeigt (Ebenen-Panel bzw. Bild-Overlay-Editor): KML-Datei einbinden, KML per URL einbinden, KML-Sichtbarkeit, KML neu laden, Bild-Overlay einbinden, Bild-Overlay-Sichtbarkeit, Deckkraft, Position und Größe, Bild ersetzen. Der Ladezustand endet, und jeder Schalter zeigt den gespeicherten Zustand.
- **AC-4** Die Meldungen, die heute bei Fehlern der KML- und Bild-Actions erscheinen, bleiben wörtlich gleich, auch für unerwartete Serverfehler in Actions, die heute eine eigene Meldung dafür haben, u. a. „KML konnte nicht geladen werden.“, „Das Bild konnte nicht eingebunden werden.“, „Bitte eine KML-URL angeben.“, „Keine Datei ausgewählt.“ und die Meldung jedes `ValidationError`.
- **AC-5** Ein unerwarteter Fehler in einer Action mit eigener Meldung dafür (KML-Datei einbinden, KML per URL einbinden, KML neu laden, Bild-Overlay einbinden, Bild ersetzen, Bild-Overlay löschen) erscheint mit dem Fehlerobjekt im Server-Log. Die übrigen Actions werfen unerwartete Fehler wie heute weiter. Ein `ValidationError` erscheint dort nicht.
- **AC-6** Bild-Overlay löschen verhält sich wie heute: Scheitert nur das Aufräumen der Datei, verschwindet das Overlay trotzdem bei allen Clients, der Nutzer sieht keinen Fehler, und der Dateipfad steht im Server-Log. Scheitert das Löschen selbst unerwartet, erscheint „Das Bild-Overlay konnte nicht gelöscht werden.“
- **AC-7** Ohne Anmeldung ändert keine Einsatz-Action etwas. Ist die Sitzung abgelaufen, führt jede in AC-2 und AC-3 genannte Aktion zur Anmeldeseite, ohne vorher eine Fehlermeldung zu zeigen.
- **AC-8** `tsc --noEmit` schlägt fehl, wenn `SituationWorkspace` oder `LageansichtShell` ohne `viewLinks`, `onCreateViewLink` oder `onDeleteViewLink` gerendert wird, wenn ein `WorkspaceSymbol` ohne `positionSource`, `reportedAt` oder `deviceLinkToken` übergeben wird, oder wenn ein `StatefulSymbol` ohne `positionSource` oder `reportedAt` übergeben wird.

## Agreed design

Serverseitig läuft jede mutierende Einsatz-Action über `operationAction`.
`operationAction` bekommt eine optionale Fallback-Meldung: Mit ihr wird ein
unerwarteter Fehler protokolliert und als diese Meldung zurückgegeben, ohne sie
fliegt er wie heute weiter. `createViewLinkAction` und die KML-/Bild-Actions
mit eigenem Catch-all laufen darüber, `createViewLinkAction` ohne
Fallback-Meldung (wie `deleteViewLinkAction`), die KML-/Bild-Actions mit ihren
heutigen Texten. Außerhalb bleiben nur `deleteImageOverlayAction` und die
Aktionen in `lifecycle-actions.ts` (Einsatz schließen, wieder öffnen, löschen). Clientseitig kapselt ein kleiner Hook `busy`, `error` und das
Ausführen einer Action samt Catch-all; ihn nutzen nur die heute identischen
Stellen und `ViewLinkPanel`. Die nur für Tests optionalen Props werden Pflicht.

## Nudges

- Im Catch-all von `operationAction` Next-Navigationsfehler weiterwerfen (`unstable_rethrow`), damit `redirect`/`notFound` aus `run` durchkommen.
- Der Hook ersetzt `run` in `KmlPanel` und `ImageOverlayPanel` und `persistImage` in `SituationWorkspace`, und `ViewLinkPanel` nutzt ihn beim Erzeugen. Er erkennt eine laufende Navigation wie `ConfirmationModal` und zeigt dann keine Meldung; `isNextNavigation` dafür aus `src/app/ConfirmationModal.tsx` herauslösen und teilen, statt es zu kopieren.
- `createViewLinkAction` liefert `ActionResult`; `onCreate`/`onCreateViewLink` sind überall `(label: string) => Promise<ActionResult>`.
- Die leere KML-URL wird innerhalb von `run` als `ValidationError` gemeldet, nicht per Rückgabe vor `operationAction`.
- `toError` in `image-overlay-actions.ts` bleibt nur für `deleteImageOverlayAction`, das unerwartete Fehler weiter protokolliert (AC-5); die übrigen Bild-Actions protokollieren über `operationAction`.
- Die Kommentare, die erklären, warum KML-, Bild- und Ansichtslink-Actions nicht über `operationAction` laufen, an den neuen Stand anpassen oder löschen.
- Fixtures ergänzen statt Props optional zu lassen: vor allem `buildProps` in `src/map/SituationWorkspace.fixtures.tsx`; den `noop`-Default in `LageansichtShell` entfernen.
- `SymbolDetailModal`, `AreaEditorModal`, `JournalPanel`, `StrengthPanel` und `runMapAction` in `SituationWorkspace` nicht anfassen.

## Out of scope

- Ein gemeinsamer Hook für Dialoge, ETB, Stärke und Kartenfehler: Sie unterscheiden sich gewollt (schließen bei Erfolg, Entwurf leeren, gemeinsamer Kartenfehler-Kanal).
- Andere Fehlertexte in bestehenden Dialogen und Panels.
- Die `noop`-Defaults in `OperationsOverview`.
- Die Aktionen in `lifecycle-actions.ts`.

## Ruled out

- **Ein Datei-Eingang im Ebenen-Panel** – die Eingänge sind beschriftet, und `accept` filtert ohnehin; die Zusammenlegung zöge `busy`/`error` beider Panels nach oben und bräuchte eine Weiche zwischen Entpacken im Client (KML) und Hochladen (Bild), für ein Bedienelement weniger.
- **Ein Hook für alle busy/Fehler-Varianten** – bräuchte so viele Optionen, dass er nicht einfacher wäre als die Varianten.
- **Ansichtslink erzeugen ohne Live-Ereignis lassen** – dann sehen andere Clients neue Links nicht; der zusätzliche Refresh ist harmlos.
