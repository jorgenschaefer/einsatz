# Vereinfachungen – offene Vorschläge

Ergebnis des Vereinfachungs-Durchgangs vom 2026-09-28 (Commit `602bf31`).
Was sich ohne Verhaltensänderung vereinfachen ließ, ist dort umgesetzt. Die
Punkte hier ändern Verhalten, Oberfläche oder Tests spürbar und brauchen daher
eine Entscheidung. Jeder Punkt nennt, was er bringt, was er kostet und was
wegfällt.

## Oberfläche

### 1. Löschen einheitlich bestätigen

**Heute.** Jede Löschung verhält sich anders:

- Einsatz löschen und ETB-Eintrag annullieren fragen in einem Modal nach
  (`OperationLifecycleActions`, `JournalPanel`).
- Ansichtslink löschen fragt inline in der Zeile nach (`ViewLinkPanel`).
- Kartenzeichen, Bereich, KML-Overlay und Bild-Overlay werden ohne Rückfrage
  gelöscht (`SituationWorkspace`, `AreaEditor`, `KmlPanel`,
  `ImageOverlayEditor`).
- „Gerätelink neu generieren" macht den alten Link sofort ungültig, ebenfalls
  ohne Rückfrage (`DeviceLinkPanel`).

**Vorschlag.** Ein gemeinsames Bestätigungs-Modal für alles, was sich nicht
rückgängig machen lässt; die Inline-Bestätigung beim Ansichtslink entfällt.

**Bringt.** Ein Muster statt drei; kein versehentliches Löschen per
Fehl-Tap am Handy; der Code für Bestätigungen liegt an einer Stelle.

**Kostet.** Ein Tap mehr bei jeder Löschung. Offen ist, ob auch das Entfernen
eines KML-Overlays eine Rückfrage braucht – es lässt sich meist leicht wieder
einbinden.

### 2. Gleicher Tap auf ein Kartenzeichen in beiden Nur-Lesen-Ansichten

**Heute.** In der Geräteansicht öffnet ein Tap auf ein Zeichen die Karten-App
des Handys (Navigation), in der Ansichtslink-Ansicht zentriert er nur die
Karte.

**Vorschlag.** Klären, ob der Unterschied fachlich gewollt ist. Geräte sind
unterwegs (Navigation sinnvoll), Mitleser sitzen eher in der Leitstelle
(Zentrieren sinnvoll) – dann bleibt es so und ist nur zu dokumentieren.
Andernfalls ein Verhalten für beide.

**Bringt.** Bei Vereinheitlichung ein Konzept weniger; `onSelect` entfiele
als Parameter von `ReadOnlySituationMap`.

**Kostet.** Wird vereinheitlicht, verliert eine der beiden Gruppen ihr
heutiges Verhalten.

### 3. Ein Datei-Eingang im Ebenen-Panel

**Heute.** Das Panel „Ebenen" hat zwei getrennte Datei-Eingänge: KML/KMZ in
`KmlPanel`, PDF/PNG in `ImageOverlayPanel`, dazu eine eigene Überschrift je
Bereich.

**Vorschlag.** Ein Eingang „Datei einbinden", der nach Dateityp an KML oder
Bild-Overlay weiterreicht.

**Bringt.** Die Führungskraft muss nicht wissen, welcher Dateityp wohin
gehört; ein Bedienelement weniger.

**Kostet.** Eine Weiche nach Dateityp im Client; die Fehlermeldungen beider
Wege müssen zusammenpassen.

## Server-Actions

### 4. `createViewLinkAction` über `operationAction`

**Heute.** `createViewLinkAction` liefert `void` statt `ActionResult`, zeigt
keine Fehler an und sendet kein Live-Ereignis (`view-link-actions.ts`). Alle
anderen Einsatz-Mutationen laufen über `operationAction`.

**Vorschlag.** `createViewLinkAction` über `operationAction` führen; `ViewLinkPanel` zeigt
`{error}` beim Erzeugen wie die übrigen Panels.

**Bringt.** Ein Ablauf für alle Mutationen; Fehler werden sichtbar statt
verschluckt.

**Kostet.** Andere offene Clients laden bei jedem neuen Ansichtslink neu
(ein zusätzlicher Refresh, fachlich harmlos).

### 5. Catch-all der KML- und Bild-Actions in `operationAction`

**Heute.** `addKmlFileAction`, `addKmlUrlAction`, `reloadKmlAction` und die
Bild-Overlay-Actions wiederholen denselben Block aus `requireUser`,
try/catch, `revalidateOperation` und `toFormError`, weil `operationAction`
unerwartete Fehler weiterwirft statt eine freundliche Meldung zu liefern.

**Vorschlag.** `operationAction` erhält eine optionale Fallback-Meldung für
unerwartete Fehler; die Actions nutzen sie.

**Bringt.** Rund 40 Zeilen weniger und ein einziger Choke-Point für
Anmeldung, Revalidierung und Fehlerübersetzung.

**Kostet.** Die Sonderfälle bleiben: `deleteImageOverlayAction` revalidiert
auch bei gescheitertem Datei-Aufräumen, und die Bild-Actions protokollieren
unerwartete Fehler. Beides muss erhalten bleiben und getestet sein.

### 6. Token-Routen für Geräte- und Ansichtslink

**Heute.** `events/route.ts` und `geocode/route.ts` gibt es je unter
`/device/[token]` und `/view/[token]`; sie unterscheiden sich nur in der
Zugangsprüfung (`resolveDeviceAccess` bzw. `resolveViewAccess`).

**Vorschlag.** Je Route einen gemeinsamen Handler, dem die Zugangsprüfung
übergeben wird.

**Bringt.** Vier fast gleiche Dateien werden zu zwei Handlern plus vier
Einzeilern.

**Kostet.** Eine Indirektion mehr; die Routen sind heute je rund 15 Zeilen und
gut lesbar. Geringer Nutzen – nur umsetzen, wenn ohnehin an den Routen
gearbeitet wird.

## Client-Zustand

### 7. Ein Muster für „beschäftigt/Fehler"

**Heute.** Dasselbe Muster aus `busy`, `error`, try/catch/finally steht in
mehreren leicht abweichenden Varianten: `run` in `KmlPanel` und
`ImageOverlayPanel` (identisch), `runDetail`, `runArea` und `persistImage` in
`SituationWorkspace`, `saveDefault` in `MapControls`, dazu mehrere Handler in
`JournalPanel`.

**Vorschlag.** Ein kleiner Hook (etwa `useActionRunner`), der `busy`,
`error` und das Ausführen einer `ActionResult`-Action kapselt.

**Bringt.** Gleiche Fehlerbehandlung überall, besonders für geworfene Fehler
(heute fangen manche Varianten sie ab, andere nicht).

**Kostet.** Die Varianten unterscheiden sich in Details (schließen bei Erfolg
ja/nein, Fallback-Text); der Hook braucht dafür Optionen. Nur lohnend, wenn
die Unterschiede sich als zufällig statt gewollt herausstellen.

### 8. Pflicht-Props statt optionaler Test-Erleichterungen

**Heute.** Einige Props sind nur optional, damit Test-Fixtures sie weglassen
können, obwohl die Produktion sie immer setzt:

- `positionSource`, `reportedAt`, `deviceLinkToken` an `WorkspaceSymbol` und
  `StatefulSymbol` (daher `?? "manual"` / `?? null` im Code),
- `viewLinks`, `onCreateViewLink`, `onDeleteViewLink` an
  `SituationWorkspace` und `LageansichtShell` (mit `noop`-Defaults).

**Vorschlag.** Als Pflicht-Props führen und die Fixtures ergänzen.

**Bringt.** Der Typ sagt, was wirklich immer da ist; die Fallbacks entfallen.

**Kostet.** Änderungen in mehreren Test-Fixtures, vor allem in
`SituationWorkspace.test.tsx`.

## Aufräumen

### 9. Alte `.png`-Overlays

**Heute.** `overlayContentType` liefert für `.png` weiterhin `image/png`,
weil vor der WebP-Umstellung angelegte Overlays noch als PNG im Volume liegen
können.

**Vorschlag.** Prüfen, ob im Produktions-Volume noch `.png`-Overlays liegen;
falls nicht (oder nach einer einmaligen Konvertierung), die Sonderbehandlung
samt Test entfernen.

**Kostet.** Eine Prüfung im laufenden Betrieb; ohne sie würden alte Overlays
mit falschem Content-Type ausgeliefert.

### 10. Laufzeit von `SituationWorkspace.test.tsx`

**Heute.** Die Datei läuft allein rund 55 s (120 Tests); die teuren benannten
Rollenabfragen sind durch Label-/Textabfragen ersetzt, geschlossene
`Select`-Dropdowns halten keine Optionen mehr im DOM. Der Rest ist
React-Rendering im Dev-Build, gut ein Viertel davon die Owner-Stacks (ein
`Error` je Element). Allein laufen die langsamsten Tests um 1 s; weil Vitest
nach Dateien parallelisiert, ist die Datei im Gesamtlauf der längste Posten.

**Vorschlag.** Die Datei nach Themen aufteilen (Hauptansicht, Kartenzeichen,
Bereiche, Bild-Overlays), damit sie sich auf die Worker verteilt.

**Bringt.** Ein verlässlicher `npm run check` auch auf ausgelasteten
Maschinen.
