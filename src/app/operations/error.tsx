"use client";

import { Alert, Button, Container, Stack } from "@mantine/core";
import { useEffect } from "react";

export default function OperationsError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Container py="lg">
      <Stack>
        <Alert color="red" title="Ladefehler">
          Diese Seite konnte nicht geladen werden.
        </Alert>
        <Button onClick={reset} w="fit-content">
          Erneut versuchen
        </Button>
      </Stack>
    </Container>
  );
}
