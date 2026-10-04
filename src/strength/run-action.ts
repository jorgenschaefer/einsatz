import type { ActionResult } from "@/app/action-result";

const SAVE_ERROR = "Speichern fehlgeschlagen. Bitte erneut versuchen.";

/** Führt die Action aus und zeigt ihren Fehler; nur bei Erfolg wird `done` aufgerufen. */
export async function runAction(
  action: () => Promise<ActionResult>,
  setError: (error: string | null) => void,
  done: () => void,
) {
  try {
    const { error } = await action();
    setError(error ?? null);
    if (!error) done();
  } catch {
    setError(SAVE_ERROR);
  }
}
