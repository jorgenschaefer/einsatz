import "server-only";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/current-user";
import type { AuthenticatedUser } from "@/server/auth/users";
import type { Db } from "@/server/db/db";
import { getDb } from "@/server/db/pg";
import { publishOperationChanged } from "@/server/events/operation-events";
import { ValidationError } from "@/server/validation";

export interface ActionResult {
  error?: string;
}

/**
 * Der eine Ort für „dieser Einsatz hat sich geändert": revalidiert die
 * Einsatzseite und meldet die Änderung live (SSE) an alle Clients.
 */
export function revalidateOperation(operationId: string): void {
  revalidatePath(`/operations/${operationId}`);
  publishOperationChanged(operationId);
}

/**
 * Übersetzt einen Fehler in einen Formularfehler: eine Business-
 * {@link ValidationError} trägt ihre Meldung, alles andere fällt auf `fallback`
 * zurück. Für Actions mit eigenem Catch-all (KML/Bild-Overlay) gedacht.
 */
export function toFormError(err: unknown, fallback: string): ActionResult {
  if (err instanceof ValidationError) return { error: err.message };
  return { error: fallback };
}

/**
 * Gemeinsamer Ablauf mutierender Einsatz-Actions – der eine Choke-Point, den die
 * Auth-Tests (S2) absichern, analog zum `guarded` der Nutzerverwaltung: erzwingt
 * die Anmeldung, führt die Domänenlogik aus, revalidiert danach den Einsatz und
 * übersetzt eine Business-{@link ValidationError} einheitlich in einen
 * Formularfehler (unerwartete Fehler fliegen weiter). `run` liefert die
 * `operationId`, die anschließend revalidiert wird.
 */
export async function operationAction(
  run: (db: Db, user: AuthenticatedUser) => Promise<string>,
): Promise<ActionResult> {
  const user = await requireUser();
  const db = getDb();
  let operationId: string;
  try {
    operationId = await run(db, user);
  } catch (err) {
    if (err instanceof ValidationError) return { error: err.message };
    throw err;
  }
  revalidateOperation(operationId);
  return {};
}
