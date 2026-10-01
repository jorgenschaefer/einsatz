"use client";

import { useState } from "react";
import { settleAction } from "@/app/action-failure";
import {
  closeActionError,
  type NotificationSource,
  showActionError,
} from "@/app/action-notification";
import type { ActionResult } from "@/app/action-result";

/**
 * Führt eine Action aus, hält dabei `busy` und meldet ihren Fehler als
 * Benachrichtigung der Quelle. Beim Start schließt die Benachrichtigung einer
 * früheren Action; navigiert die Action (etwa zur Anmeldung), liefert `run`
 * `null`, zeigt nichts und bleibt `busy`, bis die Seite ersetzt ist.
 */
export function useNotifyingActionRunner(
  notificationSource: NotificationSource,
) {
  const [busy, setBusy] = useState(false);

  const run = async <R extends ActionResult>(
    action: () => Promise<R>,
  ): Promise<R | ActionResult | null> => {
    setBusy(true);
    closeActionError(notificationSource);
    const result = await settleAction(action);
    if (!result) return null;
    if (result.error) showActionError(notificationSource, result.error);
    setBusy(false);
    return result;
  };

  const closeError = () => closeActionError(notificationSource);

  return { busy, run, closeError };
}
