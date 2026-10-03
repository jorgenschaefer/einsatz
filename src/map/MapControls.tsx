"use client";

import { ActionIcon, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconHome, IconHomeEdit } from "@tabler/icons-react";
import type { ActionResult } from "@/app/action-result";
import { ConfirmationModal } from "@/app/ConfirmationModal";

/**
 * Die Spalte der Kartenknöpfe unten rechts: Standard-Ausschnitt festlegen
 * (erst nach Rückfrage) und zurück dorthin.
 */
export function MapControls({
  onSetDefault,
  onReturnToDefault,
  canReturnToDefault,
}: {
  onSetDefault: () => Promise<ActionResult>;
  onReturnToDefault: () => void;
  canReturnToDefault: boolean;
}) {
  const [confirmOpened, confirm] = useDisclosure(false);

  return (
    <Stack
      role="group"
      aria-label="Kartenknöpfe"
      gap={8}
      className="map-controls"
    >
      <Stack gap={8} className="map-controls__view">
        <ActionIcon
          variant="default"
          size="lg"
          aria-label="Standard-Ausschnitt festlegen"
          onClick={confirm.open}
        >
          <IconHomeEdit size={18} />
        </ActionIcon>
        <ActionIcon
          variant="default"
          size="lg"
          aria-label="Zum Standard-Ausschnitt zurück"
          disabled={!canReturnToDefault}
          onClick={onReturnToDefault}
        >
          <IconHome size={18} />
        </ActionIcon>
      </Stack>
      <ConfirmationModal
        opened={confirmOpened}
        onClose={confirm.close}
        title="Standard-Ausschnitt festlegen"
        confirmLabel="Festlegen"
        confirmColor="blue"
        onConfirm={onSetDefault}
      >
        <Text>
          Der aktuelle Kartenausschnitt wird zum Standard-Ausschnitt dieses
          Einsatzes.
        </Text>
      </ConfirmationModal>
    </Stack>
  );
}
