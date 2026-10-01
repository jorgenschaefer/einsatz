"use client";

import { Alert, type AlertProps } from "@mantine/core";

/** Rote Fehlermeldung mit „ד, das sie schließt; ohne Meldung nichts. */
export function ErrorAlert({
  error,
  onClose,
  ...props
}: { error: string | null; onClose: () => void } & Omit<
  AlertProps,
  "children" | "onClose"
>) {
  if (!error) return null;
  return (
    <Alert
      color="red"
      role="alert"
      withCloseButton
      closeButtonLabel="Meldung schließen"
      onClose={onClose}
      {...props}
    >
      {error}
    </Alert>
  );
}
