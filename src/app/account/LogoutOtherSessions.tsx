"use client";

import { Alert, Button, Stack, Text } from "@mantine/core";
import { useState } from "react";
import type { ActionResult } from "@/app/action-result";
import { ConfirmationModal } from "@/app/ConfirmationModal";

/** „Überall abmelden": beendet nach Rückfrage alle anderen Sitzungen. */
export function LogoutOtherSessions({
  action,
}: {
  action: () => Promise<ActionResult>;
}) {
  const [asking, setAsking] = useState(false);
  const [done, setDone] = useState(false);

  const confirm = async () => {
    const result = await action();
    if (!result.error) setDone(true);
    return result;
  };

  return (
    <Stack maw={360} align="flex-start">
      {done && (
        <Alert color="green">Alle anderen Sitzungen wurden beendet.</Alert>
      )}
      <Button variant="default" onClick={() => setAsking(true)}>
        Überall abmelden
      </Button>
      <ConfirmationModal
        opened={asking}
        onClose={() => setAsking(false)}
        title="Alle anderen Sitzungen beenden?"
        confirmLabel="Sitzungen beenden"
        onConfirm={confirm}
      >
        <Text>
          Auf allen anderen Geräten und in allen anderen Browsern musst du dich
          danach neu anmelden. Hier bleibst du angemeldet.
        </Text>
      </ConfirmationModal>
    </Stack>
  );
}
