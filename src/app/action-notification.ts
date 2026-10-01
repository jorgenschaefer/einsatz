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
