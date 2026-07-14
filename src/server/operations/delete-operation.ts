import type { Db } from "@/server/db/db";
import { listImageOverlays } from "@/server/image-overlays/image-overlays";
import { deleteOverlayFiles } from "@/server/image-overlays/image-storage";
import { deleteOperationRow } from "./operations";

/**
 * Löscht einen Einsatz vollständig: entfernt die Bild-Overlay-Dateien aus dem
 * Uploads-Volume **und** die Einsatz-Zeile (Kartenobjekte/ETB kaskadieren in der
 * DB). Die Datei-Aufräumregel gehört in die Domäne, nicht in die Action, damit
 * kein künftiger Aufrufer die Dateien verwaisen lässt.
 */
export async function deleteOperation(db: Db, id: string): Promise<void> {
  const filePaths = (await listImageOverlays(db, id)).map((o) => o.filePath);
  await deleteOperationRow(db, id);
  await deleteOverlayFiles(filePaths);
}
