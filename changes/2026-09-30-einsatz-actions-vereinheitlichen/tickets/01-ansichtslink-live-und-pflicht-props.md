---
criteria:  CRITERIA.md
closes:    AC-1, AC-8
advances:  AC-7
after:
status:    done
attempts:  1
---

## Build
Ansichtslink erzeugen läuft über `operationAction` und meldet die Änderung
live wie jede andere Einsatz-Mutation; die Action liefert `ActionResult`, und
dieser Typ reicht bis zu `ViewLinkPanel` durch. Die Props, die nur für Tests
optional sind, werden Pflicht.

## Done when
> **AC-1** Legt eine Führungskraft einen Ansichtslink an, erscheint er bei allen anderen angemeldeten Clients desselben Einsatzes ohne Neuladen.

> **AC-8** `tsc --noEmit` schlägt fehl, wenn `SituationWorkspace` oder `LageansichtShell` ohne `viewLinks`, `onCreateViewLink` oder `onDeleteViewLink` gerendert wird, wenn ein `WorkspaceSymbol` ohne `positionSource`, `reportedAt` oder `deviceLinkToken` übergeben wird, oder wenn ein `StatefulSymbol` ohne `positionSource` oder `reportedAt` übergeben wird.

Zu AC-7: Ansichtslink erzeugen ohne Anmeldung legt weiterhin keinen Link an
und führt zur Anmeldeseite (bestehender Test in
`src/app/operations/[id]/view-link-actions.test.ts` und
`src/app/auth-enforcement.test.ts` grün).

## Toward
> **AC-7** Ohne Anmeldung ändert keine Einsatz-Action etwas. Ist die Sitzung abgelaufen, führt jede in AC-2 und AC-3 genannte Aktion zur Anmeldeseite, ohne vorher eine Fehlermeldung zu zeigen.

## Nudges
> `createViewLinkAction` liefert `ActionResult`; `onCreate`/`onCreateViewLink` sind überall `(label: string) => Promise<ActionResult>`.

> Die Kommentare, die erklären, warum KML-, Bild- und Ansichtslink-Actions nicht über `operationAction` laufen, an den neuen Stand anpassen oder löschen.

> Fixtures ergänzen statt Props optional zu lassen: vor allem `buildProps` in `src/map/SituationWorkspace.fixtures.tsx`; den `noop`-Default in `LageansichtShell` entfernen.

> `SymbolDetailModal`, `AreaEditorModal`, `JournalPanel`, `StrengthPanel` und `runMapAction` in `SituationWorkspace` nicht anfassen.

## Context
- `src/app/operations/[id]/view-link-actions.ts`: `createViewLinkAction`
  ruft `requireUser`, `createViewLink` und nur `revalidatePath`, liefert
  `void` und sendet kein Live-Ereignis. `deleteViewLinkAction` daneben läuft
  schon über `operationAction` (`src/app/operations/[id]/operation-action.ts`),
  das nach `run` `revalidateOperation` ruft, also `revalidatePath` und
  `publishOperationChanged`.
- `createViewLinkAction` bekommt **keine** Fallback-Meldung (so steht es im
  agreed design): unerwartete Fehler fliegen weiter, wie bei
  `deleteViewLinkAction`. Die Fallback-Option von `operationAction` baut
  ohnehin erst `02-fallback-meldung-in-operation-action`.
- Typkette für das Erzeugen: `page.tsx` bindet `createViewLinkAction` an
  `onCreateViewLink` von `SituationWorkspace` → `LageansichtShell`
  (`onCreateViewLink = noop`) → `ViewLinkPanel` (`onCreate`). Alle drei
  deklarieren heute `(label: string) => void | Promise<void>`.
- Nur für Tests optional sind: `viewLinks`, `onCreateViewLink`,
  `onDeleteViewLink` an `SituationWorkspaceProps`
  (`src/map/SituationWorkspace.tsx:96-98`) und an `LageansichtShell`
  (`src/app/operations/[id]/LageansichtShell.tsx:68-70`, mit Defaults `[]`,
  `noop`, `succeed`); `positionSource`, `reportedAt`, `deviceLinkToken` an
  `WorkspaceSymbol` (`SituationWorkspace.tsx:68-70`); `positionSource`,
  `reportedAt` an `StatefulSymbol` (`src/map/placed-symbols.ts:15-16`).
  `LageansichtShell` hat nur `SituationWorkspace` als Aufrufer,
  `SituationWorkspace` nur `page.tsx`; die Produktion
  (`page.tsx:118-120`, `src/app/read-only-situation-map.ts:34-35`) setzt alle
  Werte schon.
- Die Fallbacks, die dann tot sind: `s.positionSource ?? "manual"` und
  `s.reportedAt ?? null` in `placed-symbols.ts`, und
  `symbol.deviceLinkToken ?? null`, `symbol.positionSource ?? "manual"`,
  `symbol.reportedAt ?? null` in `src/map/SymbolDetailModal.tsx:108-110`.
- Tests mit Symbolen ohne diese Felder: u. a.
  `SituationWorkspace.symbols.test.tsx`, `SymbolsPanel.test.tsx`,
  `SymbolDetailModal.test.tsx`, `DeviceView.test.tsx`,
  `ViewLinkView.test.tsx`, `DeviceLinkPanel.test.tsx`,
  `LageansichtShell.test.tsx`. `tsc` nennt nach Schritt 3 jede Stelle.

## Plan
1. **AC-1-Test, rot.** In `src/app/operations/[id]/view-link-actions.test.ts`
   neben „tells other open clients of the Einsatz that a view link was
   deleted“ einen Test: angemeldet, `subscribeOperation(op.id, listener)`,
   `createViewLinkAction(op.id, "Leitstelle")` → der Listener wurde gerufen,
   und das Ergebnis ist `{}`.
   *Beweis:* der Test schlägt fehl (kein Ereignis, Ergebnis `undefined`).
2. **Action umstellen.** `createViewLinkAction` gibt
   `operationAction(async (db) => { await createViewLink(db, { operationId, label }); return operationId; })`
   zurück, Rückgabetyp `Promise<ActionResult>`; der Kommentar über der
   Funktion („Bewusst außerhalb von `operationAction` …“) wird auf den Verweis
   zum Trust-Modell gekürzt; `revalidatePath`-, `requireUser`- und
   `getDb`-Import entfallen, wenn ungenutzt.
   *Beweis:* Schritt-1-Test grün; „refuses to create a link without a session
   and writes nothing“ und `src/app/auth-enforcement.test.ts` grün.
3. **Typkette auf `ActionResult`.** `onCreate` in `src/map/ViewLinkPanel.tsx`,
   `onCreateViewLink` in `LageansichtShell.tsx` und `SituationWorkspace.tsx`
   werden `(label: string) => Promise<ActionResult>`. `ViewLinkPanel` verhält
   sich sonst unverändert (die Meldung baut `03`).
   *Beweis:* `npx tsc --noEmit` grün nach Anpassen der Test-Mocks
   (`vi.fn(async () => ({}))` statt `async () => {}`).
4. **Ansichtslink-Props Pflicht.** In `SituationWorkspaceProps` und
   `LageansichtShell` die drei Props ohne `?`; Defaults `[]`, `noop`, `succeed`
   in `LageansichtShell` entfernen (die Konstanten `noop`/`succeed`, sobald
   ungenutzt). Test-Renderings von `LageansichtShell` ergänzen die Props.
   *Beweis:* `npx tsc --noEmit` grün; ein probeweise entfernter
   `viewLinks`-Eintrag in `buildProps` lässt `tsc` scheitern (danach
   zurücknehmen).
5. **Symbol-Felder Pflicht.** `positionSource`, `reportedAt`,
   `deviceLinkToken` an `WorkspaceSymbol` und `positionSource`, `reportedAt`
   an `StatefulSymbol` ohne `?`; die `??`-Fallbacks in `placed-symbols.ts` und
   `SymbolDetailModal.tsx:108-110` entfernen. Die Test-Fixtures, die `tsc`
   meldet, ergänzen (`positionSource: "manual", reportedAt: null`, und
   `deviceLinkToken: null` für `WorkspaceSymbol`); wo mehrere Tests einer Datei
   dasselbe Symbol bauen, eine kleine Fabrik in der Datei statt Wiederholung.
   *Beweis:* `npx tsc --noEmit` grün; ein probeweise entferntes
   `positionSource` an einem Fixture lässt `tsc` scheitern.
6. **Abschluss.** *Beweis:* `npm run check` grün. AC-8 pinnt kein
   bleibender Test; die Probe mit `tsc` aus Schritt 4 und 5 unter
   `## Left standing` festhalten.

Entschieden: Die `??`-Zeilen in `SymbolDetailModal.tsx` gehören zu dieser
Änderung (sie sind die Fallbacks, die die Pflicht-Props überflüssig machen);
der Nudge „`SymbolDetailModal` … nicht anfassen“ zielt auf dessen
`save`-/Fehlerablauf, der unverändert bleibt.

## Not here
- Eine Fehlermeldung in `ViewLinkPanel` beim Erzeugen und der gemeinsame Hook:
  `03-gemeinsamer-hook-fuer-busy-und-fehler`.
- Eine Fallback-Meldung für `operationAction`:
  `02-fallback-meldung-in-operation-action`.
- Die `noop`-Defaults in `OperationsOverview` (Out of scope der Änderung).
- Der `save`-Ablauf von `SymbolDetailModal`.

## Left standing
- **AC-1 ist nur zur Hälfte durch einen automatischen Test gedeckt.** Der
  neue Test in `view-link-actions.test.ts` belegt, dass `createViewLinkAction`
  das Live-Ereignis des Einsatzes sendet und `{}` liefert. Dass der Link danach
  bei einem anderen Client ohne Neuladen erscheint, deckt kein Test ab. Der
  Review hat das im laufenden App mit zwei angemeldeten Browsern auf demselben
  Einsatz geprüft, bei 390×844 und 1920×1080: Der Link erschien im offenen
  Teilen-Dialog des zweiten Browsers ohne Neuladen.
- **AC-8 ist durch keinen bleibenden Test gepinnt**, wie im Plan vorgesehen.
  Geprüft habe ich es mit `npx tsc --noEmit`, nachdem ich jeweils eine Stelle
  probeweise entfernt und danach wiederhergestellt hatte. `tsc` schlug jedes
  Mal fehl:
  - `viewLinks`, `onCreateViewLink` und `onDeleteViewLink` einzeln aus
    `buildProps` in `SituationWorkspace.fixtures.tsx` (Rendern von
    `SituationWorkspace`);
  - dieselben drei Props einzeln an der Stelle, wo `SituationWorkspace`
    `LageansichtShell` rendert;
  - `positionSource`, `reportedAt` und `deviceLinkToken` einzeln am
    `WorkspaceSymbol` `SYMBOL` in `SituationWorkspace.fixtures.tsx`;
  - `positionSource` und `reportedAt` einzeln am `StatefulSymbol` der Fabrik
    in `placed-symbols.test.ts`.
- **Abweichung vom Plan:** Ich habe den Test „treats a missing position source
  as manual (full opacity)“ in `src/map/placed-symbols.test.ts` gelöscht. Er
  prüfte genau den `??`-Fallback, den Schritt 5 entfernt, und kompiliert mit
  dem Pflichtfeld nicht mehr. `position_source` ist in der DB `NOT NULL`, und
  dass ein manuelles Kartenzeichen nie verblasst, prüft weiterhin
  `src/map/staleness.test.ts`.
- **Zum Nudge über die Kommentare:** Nur der Kommentar in
  `view-link-actions.ts` hat sich geändert; er verweist jetzt nur noch auf das
  Trust-Modell in `operationAction`. Die Kommentare in `kml-actions.ts` und
  `image-overlay-actions.ts` habe ich stehen lassen. Sie erwähnen Ansichtslinks
  nicht, und ihre Aussage stimmt weiterhin: Diese Actions laufen wegen ihres
  eigenen Catch-alls noch nicht über `operationAction`. Die Fallback-Option,
  die das ändert, baut `02`.
