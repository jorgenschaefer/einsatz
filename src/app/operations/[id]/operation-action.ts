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

export type { ActionResult };

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
 * zurück. Nur noch für das Löschen eines Bild-Overlays, das nicht über
 * {@link operationAction} läuft.
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
 * Formularfehler. Unerwartete Fehler fliegen weiter, außer mit `fallback`: dann
 * werden sie protokolliert und als diese Meldung zurückgegeben (Next-
 * Navigationsfehler wie `redirect` fliegen trotzdem weiter). `run` liefert die
 * `operationId`, die anschließend revalidiert wird.
 *
 * Zugehörigkeit (flaches Trust-Modell): Die Kind-Objekt-Actions (Kartenzeichen,
 * Bereiche, Overlays, Ansichtslinks) mutieren über die vom Client gelieferte
 * Objekt-`id`, ohne zu prüfen, dass das Objekt zu `operationId` gehört
 * (`operationId` dient dort nur Revalidate/Live-Event). Das ist bewusst
 * unkritisch, solange jeder angemeldete Nutzer jeden Einsatz bearbeiten darf;
 * für eine künftige Per-Einsatz-Autorisierung wäre dort vor der Mutation die
 * Zugehörigkeit zu prüfen.
 */
export async function operationAction(
  run: (db: Db, user: AuthenticatedUser) => Promise<string>,
  fallback?: string,
): Promise<ActionResult> {
  const user = await requireUser();
  const db = getDb();
  let operationId: string;
  try {
    operationId = await run(db, user);
  } catch (err) {
    if (err instanceof ValidationError) return { error: err.message };
    if (fallback === undefined) throw err;
    unstable_rethrow(err);
    console.error("Einsatz-Action fehlgeschlagen:", err);
    return { error: fallback };
  }
  revalidateOperation(operationId);
  return {};
}
