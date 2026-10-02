import { notifications } from "@mantine/notifications";

/** Wer eine Benachrichtigung zeigt; je Quelle steht höchstens eine. */
export interface NotificationSource {
  id: string;
  title: string;
}

/**
 * Zeigt die Fehlermeldung einer Quelle, bis man sie schließt oder die Quelle
 * etwas Neues beginnt. Eine frühere Meldung derselben Quelle wird ersetzt;
 * `show` mit einer vorhandenen ID täte nichts.
 */
export function showActionError(
  notificationSource: NotificationSource,
  message: string,
) {
  notifications.hide(notificationSource.id);
  notifications.show({
    id: notificationSource.id,
    title: notificationSource.title,
    message,
    color: "red",
    autoClose: false,
    closeButtonProps: { "aria-label": "Meldung schließen" },
  });
}

export function closeActionError(notificationSource: NotificationSource) {
  notifications.hide(notificationSource.id);
}

// Wie oft jede Quelle verworfen wurde (beim Verlassen ihrer Ansicht).
const dismissals = new Map<string, number>();

/**
 * Schließt die Benachrichtigung der Quelle und verwirft die Fehler der
 * Actions, die schon laufen: Next bricht eine Action beim Wegnavigieren nicht
 * ab, ihr Fehler käme sonst auf der nächsten Seite an.
 */
export function dismissActionErrors(notificationSource: NotificationSource) {
  closeActionError(notificationSource);
  const { id } = notificationSource;
  dismissals.set(id, (dismissals.get(id) ?? 0) + 1);
}

/**
 * Für eine Action, die jetzt beginnt: schließt die Benachrichtigung der Quelle
 * und liefert, womit die Action ihren Fehler zeigt – außer die Quelle wurde
 * seither verworfen.
 */
export function beginAction(notificationSource: NotificationSource) {
  closeActionError(notificationSource);
  const { id } = notificationSource;
  const dismissedBefore = dismissals.get(id) ?? 0;
  return (message: string) => {
    if ((dismissals.get(id) ?? 0) === dismissedBefore) {
      showActionError(notificationSource, message);
    }
  };
}
