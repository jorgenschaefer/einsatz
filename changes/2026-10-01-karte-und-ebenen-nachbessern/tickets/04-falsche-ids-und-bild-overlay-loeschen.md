---
criteria:  CRITERIA.md
closes:    AC-13, AC-14, AC-15
advances:
after:
status:    done
attempts:  1
---

## Build
Eine ID in der URL, die keine UUID ist, endet in der Lageansicht und in den
drei Overlay-Bild-Routen als „nicht gefunden“ statt als Serverfehler. Das
Löschen eines Bild-Overlays läuft über `operationAction`, ohne dass sich
sein Verhalten ändert.

## Done when
> **AC-13** Ein angemeldeter Nutzer, der `/operations/<keine UUID>` öffnet, bekommt die Seite „nicht gefunden“ (404), keinen Serverfehler.

> **AC-14** `/operations/<id>/overlays/<keine UUID>`, `/view/<token>/overlays/<keine UUID>` und `/device/<token>/overlays/<keine UUID>` antworten jedem, der Zugang hat, mit 404.

> **AC-15** Ein Bild-Overlay löschen verhält sich wie bisher: Es verschwindet bei allen Clients. Scheitert nur das Aufräumen der Datei, bekommt der Nutzer keine Meldung, und der Dateipfad steht im Server-Log. Scheitert das Löschen selbst, erscheint „Das Bild-Overlay konnte nicht gelöscht werden.“.

## Nudges
> Eine ID, die keine UUID ist, wird in den Lookups (`getOperation`, `getImageOverlay`) abgefangen, die dann `null` liefern – kein Sonderfall je Route.

> `deleteImageOverlayAction` läuft über `operationAction(…, DELETE_FAILED)`; ein Fehler beim Aufräumen der Datei wird innerhalb von `run` abgefangen und mit Pfad geloggt. Danach `toError` und den Export von `toFormError` entfernen; die Tests von `toFormError` in `operation-action.test.ts` gehen mit, sein Verhalten pinnen die Tests von `operationAction`.

## Context
- **Ursache des 500ers**: `getOperation` (`src/server/operations/operations.ts`)
  und `getImageOverlay` (`src/server/image-overlays/image-overlays.ts`)
  reichen die ID als Parameter an `WHERE id = $1` einer `uuid`-Spalte durch.
  Postgres wirft bei Text, der keine UUID ist,
  `invalid input syntax for type uuid`. Gefunden über
  `/operations/marker-icon.png`.
- **Wer die Lookups benutzt**:
  - `getOperation`: `src/app/operations/[id]/page.tsx` (danach `notFound()`
    bei `null`), `src/app/read-only-situation-map.ts`,
    `src/server/operations/operation-lifecycle.ts` und
    `addImageOverlayAction`.
  - `getImageOverlay`: `overlayImageResponse`
    (`src/server/image-overlays/overlay-response.ts`, 404 bei `null`), das
    alle drei Overlay-Routen benutzen
    (`src/app/{operations/[id],view/[token],device/[token]}/overlays/[overlayId]/route.ts`).
    Außerdem `replaceImageOverlayFileAction` und `deleteImageOverlayAction`.
  - Für alle Aufrufer ist `null` heute schon der Fall „gibt es nicht“.
- `view`- und `device`-Tokens sind base64url-Text in `text`-Spalten, nicht
  betroffen. Bei `/operations/<keine UUID>/overlays/<uuid>` vergleicht
  `overlayImageResponse` nur Strings, das endet schon heute mit 404.
- **Testmuster**:
  - Repository-Tests mit echter DB über `freshDb()` (`src/test/db.ts`; braucht
    `docker compose -f docker-compose.test.yml up -d`), z. B.
    `operations.test.ts` „returns null for an unknown operation“.
  - Seiten-Test mit gemocktem Zugriff: `src/app/view/[token]/page.test.tsx`.
  - Die Route-Tests unter `view/…` und `device/…` mocken `getImageOverlay`
    komplett. Für AC-14 muss der echte Lookup laufen.
  - `src/app/auth-enforcement.test.ts` mockt `next/navigation` so, dass
    `notFound()` einen Fehler mit `notFound: true` wirft. Dieses Muster
    übernehmen.
- **`deleteImageOverlayAction`** (`src/app/operations/[id]/image-overlay-actions.ts`):
  läuft als einzige Einsatz-Action nicht über `operationAction`. Sie fängt
  alles in einem eigenen `try` und gibt über `toError`/`toFormError`
  `DELETE_FAILED` zurück, ohne `unstable_rethrow`. Dadurch würde ein
  `redirect` oder `notFound` verschluckt. `requireUser()` steht vor dem `try`,
  der Redirect bei abgelaufener Sitzung geht also heute schon durch.
  Revalidiert wird, sobald die Zeile gelöscht ist, auch wenn danach das
  Aufräumen der Datei scheitert.
- `operationAction` (`operation-action.ts`) revalidiert erst nach
  erfolgreichem `run`. Ein Aufräumfehler darf `run` also nicht verlassen,
  sonst würde nicht revalidiert und es käme `DELETE_FAILED`.
- Die drei Tests unter `describe("deleteImageOverlayAction")` in
  `image-overlay-actions.test.ts` pinnen AC-15 schon: Erfolg, gescheitertes
  Aufräumen mit Log und Revalidierung, gescheitertes Löschen mit Meldung und
  Log „Einsatz-Action fehlgeschlagen:“.
- `toFormError` wird nur noch von dieser Action importiert und in
  `operation-action.test.ts` (`describe("toFormError")`) direkt getestet.

## Plan
1. **Red: Lageansicht mit falscher ID (AC-13).** Neuer Test
   `src/app/operations/[id]/page.test.tsx`:
   - `requireUser` gemockt (angemeldet), `getDb` liefert eine `freshDb()`,
     `next/navigation` wie in `auth-enforcement.test.ts`.
   - `LageansichtPage({ params: Promise.resolve({ id: "marker-icon.png" }) })`
     wirft den `notFound`-Fehler und keinen anderen.
   - Zieht der Import der Seite Client-Code nach, der in Vitest nicht lädt,
     diesen gezielt mocken (z. B. `@/map/SituationWorkspace`) und das unter
     `## Left standing` vermerken.
   Beweis: rot mit `invalid input syntax for type uuid`.
2. **Red: Overlay-Routen mit falscher Overlay-ID (AC-14).** Neuer Test
   `src/app/overlay-routes.not-a-uuid.test.ts`, der die drei `GET`-Handler
   mit echter DB (`getDb` → `freshDb()`) aufruft, Overlay-ID
   `"marker-icon.png"`:
   - `operations`: `requireUser` gemockt.
   - `view` und `device`: jeweils ein echter Einsatz mit Ansichtslink bzw.
     Gerätelink aus den Repositories, damit der Zugang durchgeht.
   - Erwartet wird jeweils Status 404.
   Beweis: rot.
3. **Red: Lookups (Repository).** In `operations.test.ts` und
   `image-overlays.test.ts`: `getOperation(db, "marker-icon.png")` bzw.
   `getImageOverlay(db, "marker-icon.png")` liefert `null`. Dazu ein Fall
   mit einer UUID in Großbuchstaben, die es gibt: Sie wird weiter gefunden.
   Beweis: rot.
4. **UUID-Prüfung in den Lookups.** Neue Datei `src/server/db/uuid.ts` mit
   `isUuid(value: string): boolean`: 8-4-4-4-12 Hexziffern, ohne Rücksicht auf
   Groß- und Kleinschreibung. Getestet in neuer `src/server/db/uuid.test.ts`:
   - gültig: eine `randomUUID()`, eine in Großbuchstaben
   - ungültig: leer, `marker-icon.png`, eine UUID ohne Bindestriche, eine mit
     Leerzeichen
   `getOperation` und `getImageOverlay` geben bei `!isUuid(id)` sofort `null`
   zurück. Beweis: Tests aus 1 bis 3 grün.
5. **Red: Rethrow pinnen.** Ein Test in `image-overlay-actions.test.ts`: Wirft
   `deleteImageOverlay` einen `redirectError()` (`src/test/redirect-error`),
   fliegt er aus der Action heraus und wird nicht zu `{ error }`. Beweis:
   rot.
6. **Löschen über `operationAction` (AC-15).** In
   `image-overlay-actions.ts` `deleteImageOverlayAction` umbauen:
   - `return operationAction(async (db) => { … return operationId; }, DELETE_FAILED);`
   - Darin: Overlay lesen, `deleteImageOverlay`, dann das Aufräumen der Datei
     in einem eigenen `try`/`catch`, das mit Pfad loggt wie heute.
   - Den Kommentar über der Action an den neuen Ablauf anpassen.
   - `toError` entfernen.
   - Den Export und die Funktion `toFormError` in `operation-action.ts`
     entfernen, samt `describe("toFormError")` in `operation-action.test.ts`.
     Dass `ValidationError` und Fallback richtig übersetzt werden, pinnen die
     `operationAction`-Tests dort. Wenn ein Fall dort fehlt, ihn dort
     ergänzen.
   Beweis: der Test aus 5 grün, die drei `deleteImageOverlayAction`-Tests
   unverändert grün.
7. **Im Browser prüfen** (Skill `run-einsatz`), angemeldet:
   - `/operations/marker-icon.png` zeigt die „nicht gefunden“-Seite.
   - `/operations/<echte id>/overlays/x` antwortet mit 404.
   - Ein Bild-Overlay löschen funktioniert wie bisher.
8. `npm run check` grün.

## Not here
- Andere Lookups (Kartenzeichen, Bereiche, KML-Overlays …) bekommen keine
  UUID-Prüfung. Sie hängen nicht an einer URL, die ein Nutzer aufruft.
- Die Darstellung der KML-Punkte, die zu dem 500er geführt hat, ist
  Ticket 03.
- Andere Fehlertexte – out of scope.

## Left standing
- Nicht übernommene Review-Meldung (Kleinigkeit): Der Review schlug vor, die
  Fälle aus `src/app/overlay-routes.not-a-uuid.test.ts` neben die Routen in
  deren `route.test.ts` zu legen. Sie bleiben, wo der Plan sie vorsieht. Grund:
  Die vorhandenen `route.test.ts` unter `view/…` und `device/…` mocken
  `getImageOverlay` und den Zugang komplett, für AC-14 muss der echte Lookup
  mit echter DB laufen. Beides in einer Datei hieße, die Mocks je Test
  umzubauen.
- Abweichung vom Plan, Schritt 6 (Kleinigkeit): Das `try`/`catch` um das
  Aufräumen der Datei steht in einer Hilfsfunktion `cleanUpOverlayFile`, die
  innerhalb von `run` aufgerufen wird. Das Verhalten ist dasselbe.
- Plan, Schritt 3: Die Fälle mit einer UUID in Großbuchstaben waren schon vor
  der Änderung grün, weil Postgres sie annimmt. Sie pinnen, dass die neue
  Prüfung sie nicht abweist (und damit das `i` im regulären Ausdruck).
- Plan, Schritt 7: Den Browser habe ich nicht selbst geprüft; das hat der
  Review getan. `/operations/marker-icon.png` zeigt angemeldet die Seite
  „nicht gefunden“ (1280 × 800 und 390 × 844), `/operations/<id>/overlays/x`
  antwortet mit 404, und ein Bild-Overlay hochladen und löschen funktioniert
  wie bisher (Liste, Karte, Datei im Volume weg, keine Meldung). Das Löschen
  lief nur in Desktop-Größe. Die Ansichtslink- und Geräte-Routen hat niemand
  im Browser aufgerufen; sie sind durch die neuen Tests belegt.
- AC-15 „verschwindet bei allen Clients“: Im Test ist belegt, dass revalidiert
  und das Live-Ereignis gesendet wird. Dass ein zweiter, gleichzeitig offener
  Client das Overlay verliert, hat niemand im Browser geprüft.
- Gesehen, nicht Teil dieses Tickets: Die Seite „nicht gefunden“ ist Nexts
  englische Standardseite („This page could not be found.“), auch für eine
  gültige, aber unbekannte UUID.
