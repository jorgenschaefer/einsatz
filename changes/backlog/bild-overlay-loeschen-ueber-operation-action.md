---
effort: XS
complexity: S
utility: S
---

# Bild-Overlay löschen über `operationAction` laufen lassen

`deleteImageOverlayAction` in `src/app/operations/[id]/image-overlay-actions.ts`
läuft als einzige Einsatz-Action mit eigener Fallback-Meldung nicht über
`operationAction`. Sie fängt unerwartete Fehler mit eigenem `toError` und
`toFormError`. Das macht dasselbe wie der Fallback-Zweig von
`operationAction`, aber ohne `unstable_rethrow`, sodass ein `redirect` oder
`notFound` aus der Action verschluckt würde. `toFormError` wird nur noch dafür
aus `operation-action.ts` exportiert.

Der Review von „Einsatz-Actions vereinheitlichen“ (2026-09-30) hat geprüft,
dass `operationAction(…, DELETE_FAILED)` alle Tests zu dieser Action grün
lässt. Damals blieb es beim vereinbarten Entwurf, der die Action ausdrücklich
außen vor ließ.

Zu beachten: Ein Fehler beim Aufräumen der Datei darf weiterhin nicht als
Fehler beim Nutzer ankommen. Das Overlay verschwindet trotzdem bei allen
Clients, und der Dateipfad steht im Server-Log. Danach `toError` und den Export
von `toFormError` entfernen.
