import type { Db } from "@/server/db/db";
import { deleteOperationUploads } from "@/server/image-overlays/image-storage";
import { deleteOperationRow } from "./operations";

/**
 * Löscht einen abgeschlossenen Einsatz vollständig und meldet, ob er gelöscht
 * wurde; ein laufender bleibt samt Dateien stehen. Entfernt die Einsatz-Zeile
 * (Kartenobjekte/ETB kaskadieren in der DB) **und** sein Verzeichnis im
 * Uploads-Volume. Die Datei-Aufräumregel gehört in die Domäne, nicht in die
 * Action, damit kein künftiger Aufrufer die Dateien verwaisen lässt.
 */
export async function deleteOperation(db: Db, id: string): Promise<boolean> {
  if (!(await deleteOperationRow(db, id))) return false;
  await deleteOperationUploads(id);
  return true;
}
