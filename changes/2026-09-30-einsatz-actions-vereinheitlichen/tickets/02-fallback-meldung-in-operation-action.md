---
criteria:  CRITERIA.md
closes:    AC-4, AC-5, AC-6
advances:
after:
status:    ready
attempts:  0
---

## Build
`operationAction` bekommt eine optionale Fallback-Meldung: Mit ihr wird ein
unerwarteter Fehler protokolliert und als diese Meldung zurückgegeben. Die
KML- und Bild-Actions mit eigenem Catch-all laufen darüber, mit ihren heutigen
Texten; nur `deleteImageOverlayAction` bleibt außerhalb.

## Done when
> **AC-4** Die Meldungen, die heute bei Fehlern der KML- und Bild-Actions erscheinen, bleiben wörtlich gleich, auch für unerwartete Serverfehler in Actions, die heute eine eigene Meldung dafür haben, u. a. „KML konnte nicht geladen werden.“, „Das Bild konnte nicht eingebunden werden.“, „Bitte eine KML-URL angeben.“, „Keine Datei ausgewählt.“ und die Meldung jedes `ValidationError`.

> **AC-5** Ein unerwarteter Fehler in einer Action mit eigener Meldung dafür (KML-Datei einbinden, KML per URL einbinden, KML neu laden, Bild-Overlay einbinden, Bild ersetzen, Bild-Overlay löschen) erscheint mit dem Fehlerobjekt im Server-Log. Die übrigen Actions werfen unerwartete Fehler wie heute weiter. Ein `ValidationError` erscheint dort nicht.

> **AC-6** Bild-Overlay löschen verhält sich wie heute: Scheitert nur das Aufräumen der Datei, verschwindet das Overlay trotzdem bei allen Clients, der Nutzer sieht keinen Fehler, und der Dateipfad steht im Server-Log. Scheitert das Löschen selbst unerwartet, erscheint „Das Bild-Overlay konnte nicht gelöscht werden.“

## Nudges
> Im Catch-all von `operationAction` Next-Navigationsfehler weiterwerfen (`unstable_rethrow`), damit `redirect`/`notFound` aus `run` durchkommen.

> Die leere KML-URL wird innerhalb von `run` als `ValidationError` gemeldet, nicht per Rückgabe vor `operationAction`.

> `toError` in `image-overlay-actions.ts` bleibt nur für `deleteImageOverlayAction`, das unerwartete Fehler weiter protokolliert (AC-5); die übrigen Bild-Actions protokollieren über `operationAction`.

> Die Kommentare, die erklären, warum KML-, Bild- und Ansichtslink-Actions nicht über `operationAction` laufen, an den neuen Stand anpassen oder löschen.

## Context
- `src/app/operations/[id]/operation-action.ts`: `operationAction(run)` ruft
  `requireUser` (vor `run`, außerhalb des try), dann `run(db, user)`, wandelt
  einen `ValidationError` in `{ error }` und wirft alles andere weiter; nach
  Erfolg `revalidateOperation(operationId)`. `toFormError(err, fallback)`
  liefert die `ValidationError`-Meldung oder `fallback`. Tests:
  `operation-action.test.ts` (Mocks für `requireUser`, `getDb`,
  `revalidatePath`, `publishOperationChanged`).
- `src/app/operations/[id]/kml-actions.ts`: `addKmlFileAction`,
  `addKmlUrlAction`, `reloadKmlAction` wiederholen `requireUser` / try /
  `revalidateOperation` / `toFormError(err, "KML konnte nicht geladen werden.")`
  und protokollieren nichts. `addKmlUrlAction` gibt bei leerer URL vor dem try
  `{ error: "Bitte eine KML-URL angeben." }` zurück. Tests in
  `kml-actions.test.ts` (Mocks) decken bisher nur `setKmlVisibilityAction` und
  `removeKmlAction` ab.
- `src/app/operations/[id]/image-overlay-actions.ts`: `addImageOverlayAction`
  und `replaceImageOverlayFileAction` haben dasselbe Muster mit
  `toError(err, EMBED_FAILED)`, das Nicht-`ValidationError`s mit
  `console.error("Bild-Overlay-Verarbeitung fehlgeschlagen:", err)`
  protokolliert. Beide prüfen vor dem try `file instanceof File`
  („Keine Datei ausgewählt.“). Beide räumen eine schon gespeicherte Datei auf,
  wenn die DB-Zeile scheitert (inneres try/catch, bleibt).
  `deleteImageOverlayAction` bleibt wie es ist, samt `toError(err,
  DELETE_FAILED)`. Tests in `image-overlay-actions.test.ts` laufen gegen
  `freshDb()` (Postgres-Container, siehe `CLAUDE.md`) und prüfen u. a. bei
  174 („does not orphan the new file …“), 217 und 246 das Log.
- `src/app/auth-enforcement.test.ts` ruft jede dieser Actions ohne Sitzung und
  erwartet den Redirect zur Anmeldung, ohne Schreiben.

## Plan
1. **Tests für `operationAction` mit Fallback, rot.** In
   `operation-action.test.ts`: (a) mit Fallback wird ein `Error("boom")` zu
   `{ error: <Fallback> }`, `console.error` bekommt das Fehlerobjekt, kein
   Revalidate; (b) ein `ValidationError` liefert weiter seine Meldung, kein
   `console.error`; (c) ein `redirect("/login")` aus `next/navigation` in `run`
   fliegt trotz Fallback weiter; (d) ohne Fallback bleibt „rethrows
   unexpected (non-validation) errors“ grün.
   *Beweis:* (a) und (c) schlagen fehl.
2. **Fallback in `operationAction`.** Zweiter, optionaler Parameter
   `fallback?: string`. Im catch: `ValidationError` → Meldung; sonst ohne
   Fallback weiterwerfen; mit Fallback erst `unstable_rethrow(err)`, dann
   `console.error("Einsatz-Action fehlgeschlagen:", err)` und
   `{ error: fallback }`. JSDoc anpassen („unerwartete Fehler fliegen weiter,
   außer mit Fallback …“), ebenso den von `toFormError` („Für Actions mit
   eigenem Catch-all (KML/Bild-Overlay)“ → nur noch das Löschen eines
   Bild-Overlays).
   *Beweis:* Schritt-1-Tests grün.
3. **KML-Tests, rot wo neu.** In `kml-actions.test.ts` die Mocks um
   `createKmlOverlay`, `reloadKmlOverlay` und `@/server/kml/kml-fetch`
   erweitern und je für `addKmlFileAction`, `addKmlUrlAction`,
   `reloadKmlAction` prüfen: Erfolg → `{}` und Revalidate; `ValidationError` →
   seine Meldung, kein Log; `Error` → „KML konnte nicht geladen werden.“ und
   das Fehlerobjekt im Log. Dazu: leere URL → „Bitte eine KML-URL angeben.“,
   nichts angelegt, `requireUser` gerufen.
   *Beweis:* die Log-Erwartungen schlagen fehl (heute kein Log).
4. **KML-Actions umstellen.** Die drei Actions als
   `operationAction(async (db) => { …; return operationId; }, "KML konnte nicht geladen werden.")`;
   die leere URL wirft in `run` `new ValidationError("Bitte eine KML-URL angeben.")`.
   `getDb()`-Aufrufe durch das `db` aus `run` ersetzen. Den Kopfkommentar der
   Datei auf den neuen Stand kürzen.
   *Beweis:* Schritt-3-Tests grün, `auth-enforcement.test.ts` grün.
5. **Bild-Tests.** In `image-overlay-actions.test.ts` für
   `addImageOverlayAction` und `replaceImageOverlayFileAction`: ein
   unerwarteter Fehler liefert „Das Bild konnte nicht eingebunden werden.“ und
   das Fehlerobjekt steht im Log; ein Nicht-`File` liefert „Keine Datei
   ausgewählt.“ und schreibt nichts. Die Log-Erwartung in 174 prüft das
   Fehlerobjekt statt des alten Präfixes (`expect.anything(), err`).
   *Beweis:* grün vor und nach Schritt 6 (Verhalten bleibt; der Test pinnt es).
6. **Bild-Actions umstellen.** `addImageOverlayAction` und
   `replaceImageOverlayFileAction` über
   `operationAction(…, EMBED_FAILED)`; die `File`-Prüfung wirft in `run` einen
   `ValidationError("Keine Datei ausgewählt.")`; die inneren
   Aufräum-try/catch bleiben. `deleteImageOverlayAction`, `toError` und
   `DELETE_FAILED` bleiben unverändert; der Kopfkommentar sagt nur noch,
   warum das Löschen außerhalb bleibt.
   *Beweis:* alle Tests in `image-overlay-actions.test.ts` grün, darunter 217
   und 246 unverändert (AC-6); `auth-enforcement.test.ts` grün.
7. **Abschluss.** *Beweis:* `npm run check` grün (mit laufendem
   Test-Postgres).

Entschieden: Das Log-Präfix ist für alle Actions mit Fallback
„Einsatz-Action fehlgeschlagen:“; das Löschen behält sein bisheriges Präfix.

## Not here
- `createViewLinkAction`: `01-ansichtslink-live-und-pflicht-props`, ohne
  Fallback-Meldung.
- Eine Meldung im Client, wenn der Aufruf wirft:
  `03-gemeinsamer-hook-fuer-busy-und-fehler`.
- `setKmlVisibilityAction`, `removeKmlAction` und die übrigen Bild-Actions
  ohne eigene Meldung bleiben ohne Fallback.
- Die Aktionen in `lifecycle-actions.ts` (Out of scope der Änderung).

## Left standing
