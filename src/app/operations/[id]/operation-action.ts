import "server-only";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import type { ActionResult } from "@/app/action-result";
import { requireUser } from "@/server/auth/current-user";
import type { AuthenticatedUser } from "@/server/auth/users";
import type { Db } from "@/server/db/db";
import { getDb } from "@/server/db/pg";
import { publishOperationChanged } from "@/server/events/operation-events";
import { ValidationError } from "@/server/validation";

/**
 * Der eine Ort für „dieser Einsatz hat sich geändert": revalidiert die
 * Einsatzseite und meldet die Änderung live (SSE) an alle Clients.
 */
export function revalidateOperation(operationId: string): void {
  revalidatePath(`/operations/${operationId}`);
  publishOperationChanged(operationId);
}

/**
 * Gemeinsamer Ablauf mutierender Einsatz-Actions – neben `handleUpload` (die
 * Upload-Routen) der Choke-Point, den die Auth-Tests (S2) absichern, analog
 * zum `guarded` der Nutzerverwaltung: erzwingt die Anmeldung, führt die
 * Domänenlogik aus, revalidiert danach den Einsatz und übersetzt eine
 * Business-{@link ValidationError} einheitlich in einen Formularfehler.
 * Unerwartete Fehler fliegen weiter, außer mit `fallback`: dann werden sie
 * protokolliert und als diese Meldung zurückgegeben (Next-Navigationsfehler
 * wie `redirect` fliegen trotzdem weiter). `run` liefert die `operationId`,
 * die anschließend revalidiert wird.
 */
export async function operationAction(
  run: (db: Db, user: AuthenticatedUser) => Promise<string>,
  fallback?: string,
): Promise<ActionResult> {
  const user = await requireUser();
  const db = getDb();
  const { error } = await changeOperation(() => run(db, user), fallback);
  return error === undefined ? {} : { error };
}

/**
 * Der Teil von {@link operationAction} nach der Anmeldung, für Route Handler,
 * die die Sitzung selbst prüfen. `unexpected` unterscheidet einen
 * protokollierten unerwarteten Fehler von einer {@link ValidationError}.
 */
export async function changeOperation(
  run: () => Promise<string>,
  fallback?: string,
): Promise<ActionResult & { unexpected?: true }> {
  let operationId: string;
  try {
    operationId = await run();
  } catch (err) {
    if (err instanceof ValidationError) return { error: err.message };
    if (fallback === undefined) throw err;
    unstable_rethrow(err);
    console.error("Einsatz-Action fehlgeschlagen:", err);
    return { error: fallback, unexpected: true };
  }
  revalidateOperation(operationId);
  return {};
}
