"use client";

import { ActionIcon, Stack } from "@mantine/core";
import { IconHome } from "@tabler/icons-react";

/** Die Kartenknöpfe unten rechts: zurück zum Standard-Ausschnitt. */
export function MapControls({
  onReturnToDefault,
  canReturnToDefault,
}: {
  onReturnToDefault: () => void;
  canReturnToDefault: boolean;
}) {
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
          aria-label="Zum Standard-Ausschnitt zurück"
          disabled={!canReturnToDefault}
          onClick={onReturnToDefault}
        >
          <IconHome size={18} />
        </ActionIcon>
      </Stack>
    </Stack>
  );
}
