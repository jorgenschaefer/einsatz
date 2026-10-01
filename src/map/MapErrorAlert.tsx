"use client";

import { Box } from "@mantine/core";
import { ErrorAlert } from "@/app/ErrorAlert";

/** Der Fehler einer Karten-Aktion ohne eigenes Panel, unten über der Karte. */
export function MapErrorAlert({
  error,
  onClose,
}: {
  error: string | null;
  onClose: () => void;
}) {
  if (!error) return null;
  return (
    <Box
      pos="absolute"
      bottom={24}
      left={12}
      right={64}
      style={{ zIndex: 1200 }}
    >
      <ErrorAlert error={error} onClose={onClose} radius="sm" py="xs" />
    </Box>
  );
}
