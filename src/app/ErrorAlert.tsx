"use client";

import { Alert } from "@mantine/core";

/** Rote Fehlermeldung mit „ד, das sie schließt; ohne Meldung nichts. */
export function ErrorAlert({
  error,
  onClose,
}: {
  error: string | null;
  onClose: () => void;
}) {
  if (!error) return null;
  return (
    <Alert
      color="red"
      role="alert"
      withCloseButton
      closeButtonLabel="Meldung schließen"
      onClose={onClose}
    >
      {error}
    </Alert>
  );
}
