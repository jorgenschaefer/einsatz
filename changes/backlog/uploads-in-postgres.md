---
effort: S
utility: M
---

# Uploads in Postgres

Die Bilder der Bild-Overlays liegen als Dateien im Volume `uploads`
(`compose.prod.yaml:26`, `UPLOADS_DIR=/data/uploads` im `Dockerfile`); die
Datenbank hält nur den Pfad (`file_path` in
`src/server/db/migrations/007_image_overlays.sql`). Das tägliche Backup auf
dem Host läuft nur über `pg_dumpall`, die Uploads sind also gar nicht
gesichert, und ein Umzug auf einen anderen Host muss das Volume eigens
kopieren (`../infrastructure/changes/backlog/move-drk-apps.md`, Schritt 3).

Gedacht ist: die Bilder in die Datenbank legen, damit der vorhandene Dump sie
enthält und das Volume wegfällt. Das kommt vor
`../infrastructure/changes/backlog/off-machine-backups.md`, das dann nur noch
Postgres-Dumps vom Rechner kopieren muss.

Besprochen und für unproblematisch befunden:

- Platz: Das Backup behält 7 tägliche Voll-Dumps
  (`../infrastructure/compose.prod.yaml:54-57`). Dateien, auf dieselbe Art
  mitkopiert, kosteten genauso viel; `bytea` steht im Dump als Hex, gzip holt
  das ungefähr wieder herein.
- Ausliefern: Jedes Bild geht schon heute durch Node. Die drei Routen
  `…/overlays/[overlayId]` prüfen Login oder Token, dann lädt
  `overlayImageResponse` (`src/server/image-overlays/overlay-response.ts`)
  die Overlay-Zeile und liest die ganze Datei in den Speicher. Aus der
  Datenbank wäre es dieselbe Abfrage mit den Bytes.

Im Code:

- Das Ablegen steckt in `src/server/image-overlays/image-storage.ts`:
  `storeOverlayImage`, `readOverlayFile`, `deleteOverlayFiles`,
  `deleteOperationUploads`. Die Bilder sind dort schon als WebP neu kodiert.
- `image_overlays.operation_id` löscht mit `ON DELETE CASCADE`; das eigene
  Aufräumen der Dateien in `image-overlay-uploads.ts`, in
  `src/app/operations/[id]/image-overlay-actions.ts` und in
  `src/server/operations/delete-operation.ts` gibt es nur wegen des Volumes.
- Die Tests richten mit `uploadsDirPerTest` ein eigenes Verzeichnis ein.
- Die vorhandenen Dateien müssen einmal in die Datenbank übernommen werden.

`einsatz_uploads` ist am 2026-10-21 rund 24 kB groß; auf die Dauer eines
Dumps wirkt sich der Umzug also nicht spürbar aus.
